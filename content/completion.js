/***** BEGIN LICENSE BLOCK ***** {{{
Version: MPL 1.1/GPL 2.0/LGPL 2.1

The contents of this file are subject to the Mozilla Public License Version
1.1 (the "License"); you may not use this file except in compliance with
the License. You may obtain a copy of the License at
http://www.mozilla.org/MPL/

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
for the specific language governing rights and limitations under the
License.

(c) 2006-2008: Martin Stubenschrott <stubenschrott@gmx.net>

Alternatively, the contents of this file may be used under the terms of
either the GNU General Public License Version 2 or later (the "GPL"), or
the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
in which case the provisions of the GPL or the LGPL are applicable instead
of those above. If you wish to allow use of your version of this file only
under the terms of either the GPL or the LGPL, and not to allow others to
use your version of this file under the terms of the MPL, indicate your
decision by deleting the provisions above and replace them with the notice
and other provisions required by the GPL or the LGPL. If you do not delete
the provisions above, a recipient may use your version of this file under
the terms of any one of the MPL, the GPL or the LGPL.
}}} ***** END LICENSE BLOCK *****/

function Completion() //{{{
{
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////// PRIVATE SECTION /////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    const WINDOWS = navigator.platform == "Win32";

    try
    {
        var completionService = Components.classes["@mozilla.org/browser/global-history;2"]
                                          .getService(Components.interfaces.nsIAutoCompleteSearch);
    }
    catch (e) {}

    // the completion substrings, used for showing the longest common match
    var cacheFilter = {}
    var cacheResults = {}
    var substrings = [];
    var historyCache = [];
    var historyResult = null;
    var completionCache = [];

    var historyTimer = new util.Timer(50, 100, function () {
        let comp = [];
        for (let i in util.range(0, historyResult.matchCount))
            comp.push([historyResult.getValueAt(i),
                       historyResult.getCommentAt(i),
                       historyResult.getImageAt(i)]);

        //let foo = ["", "IGNORED", "FAILURE", "NOMATCH", "SUCCESS", "NOMATCH_ONGOING", "SUCCESS_ONGOING"];

        historyCache = comp;
        commandline.setCompletions(completionCache.concat(historyCache));
    });

    function Javascript()
    {
        let json = Components.classes["@mozilla.org/dom/json;1"]
                             .createInstance(Components.interfaces.nsIJSON);
        const OFFSET = 0, CHAR = 1, STATEMENTS = 2, DOTS = 3, FULL_STATEMENTS = 4, FUNCTIONS = 5;
        let stack = [];
        let top = [];  /* The element on the top of the stack. */
        let last = ""; /* The last opening char pushed onto the stack. */
        let lastNonwhite = ""; /* Last non-whitespace character we saw. */
        let lastChar = "";     /* Last character we saw, used for \ escaping quotes. */
        let lastKey = null;
        let compl = [];
        let str = "";

        let lastIdx = 0;
        let continuing = false;

        this.completers = {};

        this.iter = function iter(obj)
        {
            let iterator = (function ()
            {
                for (let k in obj)
                {
                    // Some object members are only accessible as function calls
                    try
                    {
                        yield [k, obj[k]];
                        continue;
                    }
                    catch (e) {}
                    yield [k, <>inaccessable</>]
                }
            })();
            try
            {
                // The point of 'for k in obj' is to get keys
                // that are accessible via . or [] notation.
                // Iterators quite often return values of no
                // use whatsoever for this purpose, so, we try
                // this rather dirty hack of getting a standard
                // object iterator for any object that defines its
                // own.
                if ("__iterator__" in obj)
                {
                    let oldIter = obj.__iterator__;
                    delete obj.__iterator__;
                    iterator = Iterator(obj);
                    obj.__iterator__ = oldIter;
                }
            }
            catch (e) {}
            return iterator;
        }

        /* Search the object for strings starting with @key.
         * If @last is defined, key is a quoted string, it's
         * wrapped in @last after @offset characters are sliced
         * off of it and it's quoted.
         */
        this.objectKeys = function objectKeys(objects)
        {
            if (!(objects instanceof Array))
                objects = [objects];

            // Can't use the cache. Build a member list.
            compl = [];
            for (let [,obj] in Iterator(objects))
            {
                // Things we can dereference
                if (["object", "string", "function"].indexOf(typeof obj) == -1)
                    continue;
                if (/^\[XPCNativeWrapper /.test(obj))
                    obj = obj.wrappedJSObject;

                for (let [k, v] in this.iter(obj))
                    compl.push([k, template.highlight(v, true)]);
            }
            return compl;
        }

        this.filter = function filter(compl, key, last, offset)
        {
            if (last != undefined) // Escaping the key (without adding quotes), so it matches the escaped completions.
                key = util.escapeString(key.substr(offset), "");

            completion.filterString = key;
            let res = buildLongestStartingSubstring(compl, key);
            if (res.length == 0)
            {
                substrings = [];
                res = buildLongestCommonSubstring(compl, key);
            }

            if (last != undefined) // Prepend the quote delimiter to the substrings list, so it's not stripped on <Tab>
                substrings = substrings.map(function (s) last + s);

            if (last != undefined) // We're looking for a quoted string, so, strip whatever prefix we have and quote the rest
            {
                res.forEach(function (a) a[0] = util.escapeString(a[0].substr(offset), last));
            }
            else // We're not looking for a quoted string, so filter out anything that's not a valid identifier
            {
                res = res.filter(function (a) /^[\w$][\w\d$]*$/.test(a[0]));
            }
            return res;

        }

        this.eval = function eval(arg, key)
        {
            if (!("eval" in cacheResults))
                cacheResults.eval = {};
            let cache = cacheResults.eval;
            if (!key)
                key = arg;

            if (key in cache)
                return cache[key];
            try
            {
                return cache[key] = window.eval(arg);
            }
            catch (e)
            {
                return null;
            }
        }

        /* Get an element from the stack. If @n is negative,
         * count from the top of the stack, otherwise, the bottom.
         * If @m is provided, return the @mth value of element @o
         * of the stack entey at @n.
         */
        let get = function get(n, m, o)
        {
            let a = stack[n >= 0 ? n : stack.length + n];
            if (m == undefined)
                return a;
            return a[o][a[o].length - m - 1];
        }

        function buildStack(start)
        {
            /* Push and pop the stack, maintaining references to 'top' and 'last'. */
            let push = function push(arg)
            {
                top = [i, arg, [i], [], [], []];
                last = top[CHAR];
                stack.push(top);
            }
            let pop = function pop(arg)
            {
                if (top[CHAR] != arg)
                    throw new Error("Invalid JS");
                if (i == str.length - 1)
                    completion.parenMatch = top[OFFSET];
                // The closing character of this stack frame will have pushed a new
                // statement, leaving us with an empty statement. This doesn't matter,
                // now, as we simply throw away the frame when we pop it, but it may later.
                if (top[STATEMENTS][top[STATEMENTS].length - 1] == i)
                    top[STATEMENTS].pop();
                top = get(-2);
                last = top[CHAR];
                let ret = stack.pop();
                return ret;
            }

            let i = start, c = "";     /* Current index and character, respectively. */

            // We're starting afresh.
            if (start == 0)
            {
                stack = [];
                push("#root");
            }
            else
            {
                // A new statement may have been pushed onto the stack just after
                // the end of the last string. We'll throw it away for now, and
                // add it again later if it turns out to be valid.
                let s = top[STATEMENTS];
                if (s[s.length - 1] == start)
                    s.pop();
            }

            /* Build a parse stack, discarding entries as opening characters
             * match closing characters. The stack is walked from the top entry
             * and down as many levels as it takes us to figure out what it is
             * that we're completing.
             */
            let length = str.length;
            for (; i < length; lastChar = c, i++)
            {
                c = str[i];
                if (last == '"' || last == "'" || last == "/")
                {
                    if (lastChar == "\\") // Escape. Skip the next char, whatever it may be.
                    {
                        c = "";
                        i++;
                    }
                    else if (c == last)
                        pop(c);
                }
                else
                {
                    // A word character following a non-word character, or simply a non-word
                    // character. Start a new statement.
                    if (/[\w$]/.test(c) && !/[\w\d$]/.test(lastChar) || !/[\w\d\s$]/.test(c))
                        top[STATEMENTS].push(i);

                    // A "." or a "[" dereferences the last "statement" and effectively
                    // joins it to this logical statement.
                    if ((c == "." || c == "[") && /[\w\d$\])"']/.test(lastNonwhite)
                    ||  lastNonwhite == "." && /[\w$]/.test(c))
                            top[STATEMENTS].pop();

                    switch (c)
                    {
                        case "(":
                            /* Function call, or if/while/for/... */
                            if (/[\w\d$]/.test(lastNonwhite))
                            {
                                top[FUNCTIONS].push(i);
                                top[STATEMENTS].pop();
                            }
                        case '"':
                        case "'":
                        case "/":
                        case "{":
                            push(c);
                            break;
                        case "[":
                            push(c);
                            break;
                        case ".":
                            top[DOTS].push(i);
                            break;
                        case ")": pop("("); break;
                        case "]": pop("["); break;
                        case "}": pop("{"); /* Fallthrough */
                        case ";":
                        case ",":
                            top[FULL_STATEMENTS].push(i);
                            break;
                    }

                    if (/\S/.test(c))
                        lastNonwhite = c;
                }
            }

            if (!/[\w\d$]/.test(lastChar) && lastNonwhite != ".")
                top[STATEMENTS].push(i);

            lastIdx = i;
        }

        this.complete = function complete(string)
        {
            let self = this;
            try
            {
                continuing = lastIdx && string.indexOf(str) == 0;
                str = string;
                buildStack(continuing ? lastIdx : 0);
            }
            catch (e)
            {
                liberator.dump(util.escapeString(string) + ": " + e + "\n" + e.stack);
                lastIdx = 0;
                return [0, []];
            }

            /* Okay, have parse stack. Figure out what we're completing. */

            // Find any complete statements that we can eval before we eval our object.
            // This allows for things like: let doc = window.content.document; let elem = doc.createElement...; elem.<Tab>
            let prev = 0;
            for (let [,v] in Iterator(get(0)[FULL_STATEMENTS]))
            {
                    this.eval(str.substring(prev, v + 1));
                    prev = v + 1;
            }

            // For each DOT in a statement, prefix it with TMP, eval it,
            // and save the result back to TMP. The point of this is to
            // cache the entire path through an object chain, mainly in
            // the presence of function calls. There are drawbacks. For
            // instance, if the value of a variable changes in the course
            // of inputting a command (let foo=bar; frob(foo); foo=foo.bar; ...),
            // we'll still use the old value. But, it's worth it.
            let getObj = function (frame, stop)
            {
                const TMP = "__liberator_eval_tmp";
                let statement = get(frame, 0, STATEMENTS) || 0; // Current statement.
                let prev = statement;
                window[TMP] = null;
                for (let [i, dot] in Iterator(get(frame)[DOTS]))
                {
                    if (dot < statement)
                        continue;
                    if (dot > stop)
                        break;
                    let s = str.substring(prev, dot);
                    if (prev != statement)
                        s = TMP + "." + s;
                    prev = dot + 1;
                    window[TMP] = self.eval(s, str.substring(statement, dot));
                }
                return window[TMP];
            }

            let getObjKey = function (frame)
            {
                let dot = get(frame, 0, DOTS) || -1; // Last dot in frame.
                let statement = get(frame, 0, STATEMENTS) || 0; // Current statement.
                let end = (frame == -1 ? lastIdx : get(frame + 1)[OFFSET]);

                let obj = [liberator, window]; // Default objects;
                /* Is this an object dereference? */
                if (dot < statement) // No.
                    dot = statement - 1;
                else // Yes. Set the object to the string before the dot.
                    obj = getObj(frame, dot);

                let [, space, key] = str.substring(dot + 1, end).match(/^(\s*)(.*)/);
                return [dot + 1 + space.length, obj, key];
            }

            // In a string. Check if we're dereferencing an object.
            // Otherwise, do nothing.
            if (last == "'" || last == '"')
            {
            // TODO: Make this work with unquoted integers.

                /*
                 * str = "foo[bar + 'baz"
                 * obj = "foo"
                 * key = "bar + ''"
                 */
                // The top of the stack is the sting we're completing.
                // Wrap it in its delimiters and eval it to process escape sequences.
                let string = str.substring(top[OFFSET] + 1);
                string = eval(last + string + last);

                /* Is this an object accessor? */
                if (get(-2)[CHAR] == "[") // Are we inside of []?
                {
                    /* Stack:
                     *  [-1]: "...
                     *  [-2]: [...
                     *  [-3]: base statement
                     */

                    // Yes. If the [ starts at the begining of a logical
                    // statement, we're in an array literal, and we're done.
                     if (get(-3, 0, STATEMENTS) == get(-2)[OFFSET])
                        return [0, []];

                    // Begining of the statement upto the opening [
                    let obj = getObj(-3, get(-2)[OFFSET]);
                    // After the opening [ upto the opening ", plus '' to take care of any operators before it
                    let key = str.substring(get(-2)[OFFSET] + 1, top[OFFSET]) + "''";
                    // Now eval the key, to process any referenced variables.
                    key = this.eval(key);

                    let compl = this.objectKeys(obj);
                    return [top[OFFSET], this.filter(compl, key + string, last, key.length)];
                }

                // Is this a function call?
                if (get(-2)[CHAR] == "(")
                {
                    /* Stack:
                     *  [-1]: "...
                     *  [-2]: (...
                     *  [-3]: base statement
                     */

                    // Does the opening "(" mark a function call?
                    if (get(-3, 0, FUNCTIONS) != get(-2)[OFFSET])
                        return [0, []]; // No. We're done.

                    let [offset, obj, func] = getObjKey(-3);
                    let key = str.substring(get(-2, 0, STATEMENTS), top[OFFSET]) + "''";

                    let completer = this.completers[func];
                    try
                    {
                        if (!completer)
                            completer = obj[func].liberatorCompleter;
                    }
                    catch (e) {}
                    liberator.dump({call: completer, func: func, obj: obj, string: string, args: "args"});
                    if (!completer)
                        return [0, []];

                    // Split up the arguments
                    let prev = get(-2)[OFFSET];
                    let args = get(-2)[FULL_STATEMENTS].map(function (s)
                    {
                        let ret = str.substring(prev + 1, s);
                        prev = s;
                        return ret;
                    });
                    args.push(key);

                    let compl = completer.call(this, func, obj, string, args);
                    key = this.eval(key);
                    return [top[OFFSET], this.filter(compl, key + string, last, key.length)];
                }

                // Nothing to do.
                return [0, []];
            }

            /*
             * str = "foo.bar.baz"
             * obj = "foo.bar"
             * key = "baz"
             *
             * str = "foo"
             * obj = [liberator, window]
             * key = "foo"
             */

            let [offset, obj, key] = getObjKey(-1);

            if (!/^(?:\w[\w\d]*)?$/.test(key))
                return [0, []]; /* Not a word. Forget it. Can this even happen? */

            let compl = this.objectKeys(obj);
            return [offset, this.filter(compl, key)];
        }
    };
    let javascript = new Javascript();

    function filterFavicon(array, want)
    {
        return want ? array : [a[2] ? a.slice(0, 2) : a for ([i, a] in Iterator(array))];
    }

    function buildSubstrings(str, filter)
    {
        if (filter == "")
            return;
        let length = filter.length;
        let start = 0;
        let idx;
        while ((idx = str.indexOf(filter, start)) > -1)
        {
            for (let end in util.range(idx + length, str.length + 1))
                substrings.push(str.substring(idx, end));
            start = idx + 1;
        }
    }

    // function uses smartcase
    // list = [ [['com1', 'com2'], 'text'], [['com3', 'com4'], 'text'] ]
    function buildLongestCommonSubstring(list, filter, favicon)
    {
        completion.filterString = filter;
        var filtered = [];

        var ignorecase = false;
        if (filter == filter.toLowerCase())
            ignorecase = true;

        var longest = false;
        if (options["wildmode"].indexOf("longest") >= 0)
            longest = true;

        for (let [,item] in Iterator(list))
        {
            var complist = item[0] instanceof Array ?  item[0]
                                                    : [item[0]];
            for (let [,compitem] in Iterator(complist))
            {
                let str = !ignorecase ? compitem : String(compitem).toLowerCase();

                if (str.indexOf(filter) == -1)
                    continue;

                filtered.push([compitem, item[1], favicon ? item[2] : null]);

                if (longest)
                {
                    if (substrings.length == 0)
                        buildSubstrings(str, filter);
                    else
                        substrings = substrings.filter(function (s) str.indexOf(s) >= 0);
                }
                break;
            }
        }
        if (options.get("wildoptions").has("sort"))
            filtered = filtered.sort(function (a, b) util.ciCompare(a[0], b[0]));;
        return filtered;
    }

    // this function is case sensitive
    function buildLongestStartingSubstring(list, filter, favicon)
    {
        var filtered = [];

        var longest = false;
        if (options["wildmode"].indexOf("longest") >= 0)
            longest = true;

        for (let [,item] in Iterator(list))
        {
            var complist = item[0] instanceof Array ?  item[0]
                                                    : [item[0]];
            for (let [,compitem] in Iterator(complist))
            {
                if (compitem.indexOf(filter) != 0)
                    continue;

                filtered.push([compitem, item[1], favicon ? item[2] : null]);

                if (longest)
                {
                    if (substrings.length == 0)
                    {
                        var length = compitem.length;
                        for (let k = filter.length; k <= length; k++)
                            substrings.push(compitem.substring(0, k));
                    }
                    else
                    {
                        substrings = substrings.filter(function (s) compitem.indexOf(s) == 0);
                    }
                }
                break;
            }
        }
        if (options.get("wildoptions").has("sort"))
            filtered = filtered.sort(function (a, b) util.ciCompare(a[0], b[0]));;
        return filtered;
    }

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// PUBLIC SECTION //////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    return {

        // returns the longest common substring
        // used for the 'longest' setting for wildmode
        getLongestSubstring: function getLongestSubstring()
        {
            if (substrings.length == 0)
                return "";

            var longest = substrings[0];
            for (let i = 1; i < substrings.length; i++)
            {
                if (substrings[i].length > longest.length)
                    longest = substrings[i];
            }
            return longest;
        },

        // generic filter function, also builds substrings needed
        // for :set wildmode=list:longest, if necessary
        filter: function filter(array, filter, matchFromBeginning, favicon)
        {
            if (!filter)
                return [[a[0], a[1], favicon ? a[2] : null] for each (a in array)];

            let result;
            if (matchFromBeginning)
                result = buildLongestStartingSubstring(array, filter, favicon);
            else
                result = buildLongestCommonSubstring(array, filter, favicon);
            return result;
        },

        cached: function cached(key, filter, generate, method)
        {
            if (!filter && cacheFilter[key] || filter.indexOf(cacheFilter[key]) != 0)
                cacheResults[key] = generate(filter);
            cacheFilter[key] = filter;
            if (cacheResults[key].length)
                return cacheResults[key] = this[method].apply(this, [cacheResults[key], filter].concat(Array.slice(arguments, 4)));
             return [];
        },

        // discard all entries in the 'urls' array, which don't match 'filter
        // urls must be of type [["url", "title"], [...]] or optionally
        //                      [["url", "title", keyword, [tags]], [...]]
        filterURLArray: function filterURLArray(urls, filter, filterTags)
        {
            var filtered = [];
            // completions which don't match the url but just the description
            // list them at the end of the array
            var additionalCompletions = [];

            if (urls.length == 0)
                return [];

            var hasTags = urls[0].length >= 4;
            // TODO: create a copy of urls?
            if (!filter && (!hasTags || !filterTags))
                return urls;

            filterTags = filterTags || [];

            // TODO: use ignorecase and smartcase settings
            var ignorecase = (filter == filter.toLowerCase() && filterTags.every(function (t) t == t.toLowerCase()));

            if (ignorecase)
            {
                filter = filter.toLowerCase();
                filterTags = filterTags.map(String.toLowerCase);
            }

            // Longest Common Subsequence
            // This shouldn't use buildLongestCommonSubstring for performance
            // reasons, so as not to cycle through the urls twice
            let filterTokens = filter.split(/\s+/);
            for (let [,elem] in Iterator(urls))
            {
                var url   = elem[0] || "";
                var title = elem[1] || "";
                var tags  = elem.tags || elem[3] || [];
                if (ignorecase)
                {
                    url = url.toLowerCase();
                    title = title.toLowerCase();
                    tags = tags.map(String.toLowerCase);
                }

                // filter on tags
                if (filterTags.some(function (tag) tag && tags.indexOf(tag) == -1))
                        continue;

                if (url.indexOf(filter) == -1)
                {
                    // no direct match of filter in the url, but still accept this item
                    // if _all_ tokens of filter match either the url or the title
                    if (filterTokens.every(function (token) url.indexOf(token) > -1 || title.indexOf(token) > -1))
                        additionalCompletions.push(elem);
                    continue;
                }

                // TODO: refactor out? And just build if wildmode contains longest?
                //   Of course --Kris
                if (substrings.length == 0)   // Build the substrings
                    buildSubstrings(url, filter);
                else
                    substrings = substrings.filter(function (s) url.indexOf(s) >= 0);

                filtered.push(elem);
            }

            filtered = filtered.concat(additionalCompletions);
            if (options.get("wildoptions").has("sort"))
                filtered = filtered.sort(function (a, b) util.ciCompare(a[0], b[0]));;
            return filtered;
        },

        // generic helper function which checks if the given "items" array pass "filter"
        // items must be an array of strings
        match: function match(items, filter, caseSensitive)
        {
            if (typeof filter != "string" || !items)
                return false;

            var itemsStr = items.join(" ");
            if (!caseSensitive)
            {
                filter = filter.toLowerCase();
                itemsStr = itemsStr.toLowerCase();
            }

            if (filter.split(/\s+/).every(function (str) itemsStr.indexOf(str) > -1))
                return true;

            return false;
        },

        ////////////////////////////////////////////////////////////////////////////////
        ////////////////////// COMPLETION TYPES ////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////////////{{{

        bookmark: function bookmark(filter) [0, bookmarks.get(filter)],

        // FIXME: items shouldn't be [[[a], b]], but [[a, b]] and only mapped if at all for bLCS --mst
        buffer: function buffer(filter)
        {
            var items = [];
            var num = getBrowser().browsers.length;
            var title, url;

            for (let i = 0; i < num; i++)
            {
                try
                {
                    title = getBrowser().getBrowserAtIndex(i).contentDocument.title;
                }
                catch (e)
                {
                    title = "";
                }

                url = getBrowser().getBrowserAtIndex(i).contentDocument.location.href;

                if (title.indexOf(filter) == -1 && url.indexOf(filter) == -1 &&
                        (i + 1).toString().indexOf(filter) == -1)
                    continue;

                if (title.indexOf(filter) != -1 || url.indexOf(filter) != -1 ||
                        (i + 1).toString().indexOf(filter) != -1)
                {
                    if (title == "")
                        title = "(Untitled)";
                    items.push([[(i + 1) + ": " + title, (i + 1) + ": " + url], url]);
                }
            }

            if (!filter)
                return [0, items.map(function (i) [i[0][0], i[1]])];

            return [0, buildLongestCommonSubstring(items, filter)];
        },

        command: function command(filter)
        {
            var completions = [];

            if (!filter)
            {
                for (let command in commands)
                    completions.push([command.name, command.description]);
                return [0, completions];
            }

            for (let command in commands)
                completions.push([command.longNames, command.description]);

            return [0, buildLongestStartingSubstring(completions, filter)];
        },

        dialog: function dialog(filter) [0, this.filter(config.dialogs || [], filter)],

        environment: function environment(filter)
        {
            let command = WINDOWS ? "set" : "export";
            let lines = io.system(command).split("\n");

            lines.splice(lines.length - 1, 1);

            let vars = lines.map(function (line) {
                let matches = line.match(/([^=]+)=(.+)/);
                return [matches[1], matches[2]];
            });

            return [0, this.filter(vars, filter)];
        },

        event: function event(filter) [0, this.filter(config.autocommands, filter)],

        // provides completions for ex commands, including their arguments
        ex: function ex(str)
        {
            this.filterString = "";
            this.parenMatch = null;
            substrings = [];
            if (str.indexOf(cacheFilter["ex"]) != 0)
            {
                cacheFilter = {};
                cacheResults = {};
            }
            cacheFilter["ex"] = str;

            var [count, cmd, special, args] = commands.parseCommand(str);
            var completions = [];
            var start = 0;
            var exLength = 0;

            // if there is no space between the command name and the cursor
            // then get completions of the command name
            var matches = str.match(/^(:*\d*)\w*$/);
            if (matches)
                return [matches[1].length, this.command(cmd)[1]];

            // dynamically get completions as specified with the command's completer function
            var command = commands.get(cmd);
            if (command && command.completer)
            {
                matches = str.match(/^:*\d*\w+[\s!]\s*/);
                exLength = matches ? matches[0].length : 0;
                [start, completions] = command.completer.call(this, args, special);
            }
            return [exLength + start, completions];
        },

        // TODO: support file:// and \ or / path separators on both platforms
        // if "tail" is true, only return names without any directory components
        file: function file(filter, tail)
        {
            let [matches, dir, compl] = filter.match(/^((?:.*[\/\\])?)(.*?)$/);
            // dir == "" is expanded inside readDirectory to the current dir

            let generate = function ()
            {
                var files = [], mapped = [];

                try
                {
                    files = io.readDirectory(dir, true);

                    if (options["wildignore"])
                    {
                        var wigRegexp = new RegExp("(^" + options["wildignore"].replace(",", "|", "g") + ")$");

                        files = files.filter(function (f) f.isDirectory() || !wigRegexp.test(f.leafName))
                    }

                    mapped = files.map(function (file) [tail ? file.leafName : (dir + file.leafName),
                                                        file.isDirectory() ? "Directory" : "File"]);
                }
                catch (e) {}
                return mapped;
            };

            try
            {
                if (tail)
                    return [dir.length, this.cached("file-" + dir, compl, generate, "filter", [true])];
                else
                    return [0, this.cached("file", filter, generate, "filter", [true])];
            }
            catch (e)
            {
                liberator.dump(e);
            }
        },

        help: function help(filter)
        {
            var files = config.helpFiles || [];
            var res = [];

            for (let i = 0; i < files.length; i++)
            {
                try
                {
                    var xmlhttp = new XMLHttpRequest();
                    xmlhttp.open("GET", "chrome://liberator/locale/" + files[i], false);
                    xmlhttp.send(null);
                }
                catch (e)
                {
                    liberator.log("Error opening chrome://liberator/locale/" + files[i], 1);
                    continue;
                }
                var doc = xmlhttp.responseXML;
                var elems = doc.getElementsByClassName("tag");
                for (let j = 0; j < elems.length; j++)
                    res.push([elems[j].textContent, files[i]]);
            }

            return [0, this.filter(res, filter)];
        },

        history: function history(filter) [0, history.get(filter)],

        get javascriptCompleter() javascript,

        javascript: function _javascript(str)
        {
            try
            {
                return javascript.complete(str);
            }
            catch (e)
            {
                liberator.dump(e);
                return [0, []];
            }
        },

        macro: function macro(filter)
        {
            var macros = [item for (item in events.getMacros())];

            return [0, this.filter(macros, filter)];
        },

        search: function search(filter)
        {
            let [, keyword, args] = filter.match(/^\s*(\S*)\s*(.*)/);
            let keywords = bookmarks.getKeywords();
            let engines = this.filter(keywords.concat(bookmarks.getSearchEngines()), filter, false, true);

            let generate = function () {
                let hist = history.get();
                let searches = [];
                for (let [, k] in Iterator(keywords))
                {
                    if (k[0].toLowerCase() != keyword.toLowerCase() || k[3].indexOf("%s") == -1)
                        continue;
                    let [begin, end] = k[3].split("%s");
                    for (let [, h] in Iterator(hist))
                    {
                        if (h[0].indexOf(begin) == 0 && (!end.length || h[0].substr(-end.length) == end))
                        {
                            let query = h[0].substring(begin.length, h[0].length - end.length);
                            searches.push([decodeURIComponent(query.replace("+", "%20")),
                                           <>{begin}<span class="hl-Filter">{query}</span>{end}</>,
                                           k[2]]);
                        }
                    }
                }
                return searches;
            }
            let searches = this.cached("searches-" + keyword, args, generate, "filter", [false, true]);
            searches = searches.map(function (a) (a = a.concat(), a[0] = keyword + " " + a[0], a));
            return [0, searches.concat(engines)];
        },

        // XXX: Move to bookmarks.js?
        searchEngineSuggest: function searchEngineSuggest(filter, engineAliases)
        {
            this.filterString = filter;
            if (!filter)
                return [0, []];

            var engineList = (engineAliases || options["suggestengines"]).split(",");
            var responseType = "application/x-suggestions+json";
            var ss = Components.classes["@mozilla.org/browser/search-service;1"]
                               .getService(Components.interfaces.nsIBrowserSearchService);

            var completions = [];
            engineList.forEach(function (name) {
                var query = filter;
                var queryURI;
                var engine = ss.getEngineByAlias(name);
                var reg = new RegExp("^\s*(" + name + "\\s+)(.*)$");
                var matches = query.match(reg);
                if (matches)
                    query = matches[2];

                if (engine && engine.supportsResponseType(responseType))
                    queryURI = engine.getSubmission(query, responseType).uri.asciiSpec;
                else
                    return [0, []];

                var xhr = new XMLHttpRequest();
                xhr.open("GET", queryURI, false);
                xhr.send(null);

                var json = Components.classes["@mozilla.org/dom/json;1"]
                                     .createInstance(Components.interfaces.nsIJSON);
                var results = json.decode(xhr.responseText)[1];
                if (!results)
                    return [0, []];

                results.forEach(function (item) {
                    // make sure we receive strings, otherwise a man-in-the-middle attack
                    // could return objects which toString() method could be called to
                    // execute untrusted code
                    if (typeof item != "string")
                        return [0, []];

                    completions.push([(matches ? matches[1] : "") + item, engine.name + " suggestion"]);
                });
            });

            return [0, completions];
        },

        sidebar: function sidebar(filter)
        {
            var menu = document.getElementById("viewSidebarMenu");
            var nodes = [];

            for (let i = 0; i < menu.childNodes.length; i++)
                nodes.push([menu.childNodes[i].label, ""]);

            return [0, this.filter(nodes, filter)];
        },

        stylesheet: function stylesheet(filter)
        {
            var completions = buffer.alternateStyleSheets.map(
                function (stylesheet) [stylesheet.title, stylesheet.href || "inline"]
            );

            // unify split style sheets
            completions.forEach(function (stylesheet) {
                for (let i = 0; i < completions.length; i++)
                {
                    if (stylesheet[0] == completions[i][0] && stylesheet[1] != completions[i][1])
                    {
                        stylesheet[1] += ", " + completions[i][1];
                        completions.splice(i, 1);
                    }
                }
            });

            return [0, this.filter(completions, filter)];
        },

        // filter a list of urls
        //
        // may consist of search engines, filenames, bookmarks and history,
        // depending on the 'complete' option
        // if the 'complete' argument is passed like "h", it temporarily overrides the complete option
        url: function url(filter, complete)
        {
            this.filterString = filter;
            var completions = [];
            var start = 0;
            var skip = filter.match("^(.*" + options["urlseparator"] + ")(.*)"); // start after the last 'urlseparator'
            if (skip)
            {
                start += skip[1].length;
                filter = skip[2];
            }

            var cpt = complete || options["complete"];
            var suggestEngineAlias = options["suggestengines"] || "google";
            // join all completion arrays together
            for (let c in util.arrayIter(cpt))
            {
                if (c == "s")
                    completions.push(this.search(filter)[1]);
                else if (c == "f")
                    completions.push(this.file(filter, false)[1]);
                else if (c == "S")
                    completions.push(this.searchEngineSuggest(filter, suggestEngineAlias)[1]);
                else if (c == "b")
                    completions.push(bookmarks.get(filter));
                else if (c == "h")
                    completions.push(history.get(filter));
                else if (c == "l" && completionService) // add completions like Firefox's smart location bar
                {
                    completionService.stopSearch();
                    completionService.startSearch(filter, "", historyResult, {
                        onSearchResult: function onSearchResult(search, result) {
                            historyResult = result;
                            historyTimer.tell();
                            if (result.searchResult <= result.RESULT_SUCCESS)
                                historyTimer.flush();
                        }
                    });
                }
            }

            completionCache = util.flatten(completions);
            return [start, completionCache.concat(historyCache)];
        },

        userCommand: function userCommand(filter)
        {
            let cmds = commands.getUserCommands();
            cmds = cmds.map(function (cmd) [cmd.name, ""]);
            return [0, this.filter(cmds, filter)];
        },

        userMapping: function userMapping(filter, modes)
        {
            // TODO: add appropriate getters to l.mappings
            let maps = [[m.names[0], ""] for (m in mappings.getUserIterator(modes))];
            return [0, this.filter(maps, filter)];
        }
    // }}}
    };
    //}}}
}; //}}}

// vim: set fdm=marker sw=4 ts=4 et:
