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

// also includes methods for dealing with keywords and search engines
liberator.Bookmarks = function () //{{{
{
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////// PRIVATE SECTION /////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    const historyService   = Components.classes["@mozilla.org/browser/nav-history-service;1"]
                                       .getService(Components.interfaces.nsINavHistoryService);
    const bookmarksService = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"]
                                       .getService(Components.interfaces.nsINavBookmarksService);
    const taggingService   = Components.classes["@mozilla.org/browser/tagging-service;1"]
                                       .getService(Components.interfaces.nsITaggingService);
    const searchService    = Components.classes["@mozilla.org/browser/search-service;1"]
                                       .getService(Components.interfaces.nsIBrowserSearchService);
    const ioService        = Components.classes["@mozilla.org/network/io-service;1"]
                                       .getService(Components.interfaces.nsIIOService);

    var bookmarks = null;
    var keywords = null;

    if (liberator.options["preload"])
        setTimeout(function () { load(); }, 100);

    function load()
    {
        // update our bookmark cache
        bookmarks = [];
        keywords  = [];

        var folders = [bookmarksService.toolbarFolder, bookmarksService.bookmarksMenuFolder, bookmarksService.unfiledBookmarksFolder];
        var query = historyService.getNewQuery();
        var options = historyService.getNewQueryOptions();
        while (folders.length > 0)
        {
            //comment out the next line for now; the bug hasn't been fixed; final version should include the next line
            //options.setGroupingMode(options.GROUP_BY_FOLDER);
            query.setFolders(folders, 1);
            var result = historyService.executeQuery(query, options);
            //result.sortingMode = options.SORT_BY_DATE_DESCENDING;
            result.sortingMode = options.SORT_BY_VISITCOUNT_DESCENDING;
            var rootNode = result.root;
            rootNode.containerOpen = true;

            folders.shift();
            // iterate over the immediate children of this folder
            for (var i = 0; i < rootNode.childCount; i++)
            {
                var node = rootNode.getChild(i);
                if (node.type == node.RESULT_TYPE_FOLDER)   // folder
                    folders.push(node.itemId);
                else if (node.type == node.RESULT_TYPE_URI) // bookmark
                {
                    var kw = bookmarksService.getKeywordForBookmark(node.itemId);
                    if (kw)
                        keywords.push([kw, node.title, node.uri]);

                    var count = {};
                    var tags = taggingService.getTagsForURI(ioService.newURI(node.uri, null, null), count);
                    bookmarks.push([node.uri, node.title, kw, tags]);
                }
            }

            // close a container after using it!
            rootNode.containerOpen = false;
        }
    }

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// OPTIONS /////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    liberator.options.add(["defsearch", "ds"],
        "Set the default search engine",
        "string", "google");

    liberator.options.add(["preload"],
        "Speed up first time history/bookmark completion",
        "boolean", true);

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// MAPPINGS ////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    var modes = liberator.config.browserModes || [liberator.modes.NORMAL];

    liberator.mappings.add(modes, ["a"],
        "Open a prompt to bookmark the current URL",
        function ()
        {
            var title = "";
            if (liberator.buffer.title != liberator.buffer.URL)
                title = " -title=\"" + liberator.buffer.title + "\"";
            liberator.commandline.open(":", "bmark " + liberator.buffer.URL + title, liberator.modes.EX);
        });

    liberator.mappings.add(modes, ["A"],
        "Toggle bookmarked state of current URL",
        function () { liberator.bookmarks.toggle(liberator.buffer.URL); });

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// COMMANDS ////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    liberator.commands.add(["ju[mps]"],
        "Show jumplist",
        function ()
        {
            var sh = getWebNavigation().sessionHistory;
            var list = ":" + (liberator.util.escapeHTML(liberator.commandline.getCommand()) || "jumps") + "<br/>" + "<table>";
            list += "<tr style=\"text-align: left;\" class=\"hl-Title\"><th colspan=\"2\">jump</th><th>title</th><th>URI</th></tr>";
            var num = -sh.index;

            for (var i = 0; i < sh.count; i++)
            {
                var entry = sh.getEntryAtIndex(i, false);
                var uri = entry.URI.spec;
                var title = entry.title;
                var indicator = i == sh.index? "<span style=\"color: blue;\">&gt;</span>": " ";
                list += "<tr><td>" + indicator + "<td>" + Math.abs(num) + "</td><td style=\"width: 250px; max-width: 500px; overflow: hidden;\">" + title +
                        "</td><td><a href=\"#\" class=\"hl-URL jump-list\">" + uri + "</a></td></tr>";
                num++;
            }

            list += "</table>";

            liberator.commandline.echo(list, liberator.commandline.HL_NORMAL, liberator.commandline.FORCE_MULTILINE);
        },
        { argCount: "0" });

    liberator.commands.add(["bma[rk]"],
        "Add a bookmark",
        function (args)
        {
            var url = args.arguments.length == 0 ? liberator.buffer.URL : args.arguments[0];
            var title = args["-title"] || (args.arguments.length == 0 ? liberator.buffer.title : null);
            if (!title)
                title = url;
            var keyword = args["-keyword"] || null;
            var tags =    args["-tags"] || [];

            if (liberator.bookmarks.add(false, title, url, keyword, tags))
            {
                var extra = "";
                if (title != url)
                    extra = " (" + title + ")";
                liberator.echo("Added bookmark: " + url + extra, liberator.commandline.FORCE_SINGLELINE);
            }
            else
                liberator.echoerr("Exxx: Could not add bookmark `" + title + "'", liberator.commandline.FORCE_SINGLELINE);
        },
        {
            options: [[["-title", "-t"],    liberator.commands.OPTION_STRING],
                      [["-tags", "-T"],     liberator.commands.OPTION_LIST],
                      [["-keyword", "-k"],  liberator.commands.OPTION_STRING, function (arg) { return /\w/.test(arg); }]],
            argCount: "?"
        });

    liberator.commands.add(["bmarks"],
        "List or open multiple bookmarks",
        function (args, special)
        {
            liberator.bookmarks.list(args.arguments.join(" "), args["-tags"] || [], special);
        },
        {
            completer: function (filter) { return [0, liberator.bookmarks.get(filter)]; },
            options: [[["-tags", "-T"], liberator.commands.OPTION_LIST]]
        });

    liberator.commands.add(["delbm[arks]"],
        "Delete a bookmark",
        function (args, special)
        {
            var url = args;
            if (!url)
                url = liberator.buffer.URL;

            var deletedCount = liberator.bookmarks.remove(url);
            liberator.echo(deletedCount + " bookmark(s) with url `" + url + "' deleted", liberator.commandline.FORCE_SINGLELINE);
        },
        {
            completer: function (filter) { return [0, liberator.bookmarks.get(filter)]; }
        });

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// PUBLIC SECTION //////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    return {

        // if "bypassCache" is true, it will force a reload of the bookmarks database
        // on my PC, it takes about 1ms for each bookmark to load, so loading 1000 bookmarks
        // takes about 1 sec
        get: function (filter, tags, bypassCache)
        {
            if (!bookmarks || bypassCache)
                load();

            return liberator.completion.filterURLArray(bookmarks, filter, tags);
        },

        // if starOnly = true it is saved in the unfiledBookmarksFolder, otherwise in the bookmarksMenuFolder
        add: function (starOnly, title, url, keyword, tags)
        {
            if (!bookmarks)
                load();

            // if no protocol specified, default to http://, isn't there a better way?
            if (!/^[\w-]+:/.test(url))
                url = "http://" + url;

            try
            {
                var uri = ioService.newURI(url, null, null);
                var id = bookmarksService.insertBookmark(
                         starOnly ? bookmarksService.unfiledBookmarksFolder : bookmarksService.bookmarksMenuFolder,
                         uri, -1, title);

                if (!id)
                    return false;

                if (keyword)
                {
                    bookmarksService.setKeywordForBookmark(id, keyword);
                    keywords.unshift([keyword, title, url]);
                }

                if (tags)
                    taggingService.tagURI(uri, tags);
            }
            catch (e)
            {
                liberator.log(e, 0);
                return false;
            }

            // update the display of our "bookmarked" symbol
            liberator.statusline.updateUrl();

            //also update bookmark cache
            bookmarks.unshift([url, title, keyword, tags || []]);

            liberator.autocommands.trigger("BookmarkAdd", "");

            return true;
        },

        toggle: function (url)
        {
            if (!url)
                return;

            var count = this.remove(url);
            if (count > 0)
            {
                liberator.commandline.echo("Removed bookmark: " + url, liberator.commandline.HL_NORMAL, liberator.commandline.FORCE_SINGLELINE);
            }
            else
            {
                var title = liberator.buffer.title || url;
                var extra = "";
                if (title != url)
                    extra = " (" + title + ")";
                this.add(true, title, url);
                liberator.commandline.echo("Added bookmark: " + url + extra, liberator.commandline.HL_NORMAL, liberator.commandline.FORCE_SINGLELINE);
            }
        },

        isBookmarked: function (url)
        {
            try
            {
                var uri = ioService.newURI(url, null, null);
                var count = {};
                bookmarksService.getBookmarkIdsForURI(uri, count);
            }
            catch (e)
            {
                return false;
            }

            return count.value > 0;
        },

        // returns number of deleted bookmarks
        remove: function (url)
        {
            if (!url)
                return 0;

            var i = 0;
            try
            {
                var uri = ioService.newURI(url, null, null);
                var count = {};
                var bmarks = bookmarksService.getBookmarkIdsForURI(uri, count);

                for (; i < bmarks.length; i++)
                    bookmarksService.removeItem(bmarks[i]);
            }
            catch (e)
            {
                liberator.log(e, 0);
                return i;
            }

            // also update bookmark cache, if we removed at least one bookmark
            if (count.value > 0)
                load();

            // update the display of our "bookmarked" symbol
            liberator.statusline.updateUrl();

            return count.value;
        },

        // TODO: add filtering
        // also ensures that each search engine has a Vimperator-friendly alias
        getSearchEngines: function ()
        {
            var searchEngines = [];
            var firefoxEngines = searchService.getVisibleEngines({});
            for (var i in firefoxEngines)
            {
                var alias = firefoxEngines[i].alias;
                if (!alias || !/^[a-z0-9_-]+$/.test(alias))
                    alias = firefoxEngines[i].name.replace(/^\W*([a-zA-Z_-]+).*/, "$1").toLowerCase();
                if (!alias)
                    alias = "search"; // for search engines which we can't find a suitable alias

                // make sure we can use search engines which would have the same alias (add numbers at the end)
                var newAlias = alias;
                for (var j = 1; j <= 10; j++) // <=10 is intentional
                {
                    if (!searchEngines.some(function (item) { return (item[0] == newAlias); }))
                        break;

                    newAlias = alias + j;
                }
                // only write when it changed, writes are really slow
                if (firefoxEngines[i].alias != newAlias)
                    firefoxEngines[i].alias = newAlias;

                searchEngines.push([firefoxEngines[i].alias, firefoxEngines[i].description]);
            }

            return searchEngines;
        },

        // TODO: add filtering
        // format of returned array:
        // [keyword, helptext, url]
        getKeywords: function ()
        {
            if (!keywords)
                load();

            return keywords;
        },

        // full search string including engine name as first word in @param text
        // if @param useDefSearch is true, it uses the default search engine
        // @returns the url for the search string
        //          if the search also requires a postData, [url, postData] is returned
        getSearchURL: function (text, useDefsearch)
        {
            var url = null;
            var aPostDataRef = {};
            var searchString = (useDefsearch? liberator.options["defsearch"] + " " : "") + text;

            // we need to make sure our custom alias have been set, even if the user
            // did not :open <tab> once before
            this.getSearchEngines();

            url = getShortcutOrURI(searchString, aPostDataRef);
            if (url == searchString)
                url = null;

            if (aPostDataRef && aPostDataRef.value)
                return [url, aPostDataRef.value];
            else
                return url; // can be null
        },

        // if openItems is true, open the matching bookmarks items in tabs rather than display
        list: function (filter, tags, openItems)
        {
            var items = this.get(filter, tags, false);
            if (items.length == 0)
            {
                if (filter.length > 0 && tags.length > 0)
                    liberator.echoerr("E283: No bookmarks matching tags: \"" + tags + "\" and string: \"" + filter + "\"");
                else if (filter.length > 0)
                    liberator.echoerr("E283: No bookmarks matching string: \"" + filter + "\"");
                else if (tags.length > 0)
                    liberator.echoerr("E283: No bookmarks matching tags: \"" + tags + "\"");
                else
                    liberator.echoerr("No bookmarks set");

                return;
            }

            if (openItems)
                return liberator.openTabs((i[0] for (i in items)), items.length);

            var title, url, tags, keyword, extra;
            var list = ":" + liberator.util.escapeHTML(liberator.commandline.getCommand()) + "<br/>" +
                "<table><tr align=\"left\" class=\"hl-Title\"><th>title</th><th>URL</th></tr>";
            for (var i = 0; i < items.length; i++)
            {
                title = liberator.util.escapeHTML(items[i][1]);
                if (title.length > 50)
                    title = title.substr(0, 47) + "...";
                url = liberator.util.escapeHTML(items[i][0]);
                keyword = items[i][2];
                tags = items[i][3].join(", ");

                extra = "";
                if (keyword)
                {
                    extra = "<span style=\"color: gray;\"> (keyword: <span style=\"color: red;\">" + liberator.util.escapeHTML(keyword) + "</span>";
                    if (tags)
                        extra += " tags: <span style=\"color: blue;\">" + liberator.util.escapeHTML(tags) + ")</span>";
                    else
                        extra += ")</span>";
                }
                else if (tags)
                {
                    extra = "<span style=\"color: gray;\"> (tags: <span style=\"color: blue;\">" + liberator.util.escapeHTML(tags) + "</span>)</span>";
                }

                list += "<tr><td>" + title + "</td><td style=\"width: 100%\"><a href=\"#\" class=\"hl-URL\">" + url + "</a>" + extra + "</td></tr>";
            }
            list += "</table>";

            liberator.commandline.echo(list, liberator.commandline.HL_NORMAL, liberator.commandline.FORCE_MULTILINE);
        }

    };
    //}}}
}; //}}}

liberator.History = function () //{{{
{
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////// PRIVATE SECTION /////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    const historyService = Components.classes["@mozilla.org/browser/nav-history-service;1"]
                                     .getService(Components.interfaces.nsINavHistoryService);

    var history = [];
    var cachedHistory = []; // add pages here after loading the initial Places history

    if (liberator.options["preload"])
        setTimeout(function () { load(); }, 100);

    function load()
    {
        history = [];

        // no query parameters will get all history
        // XXX default sorting is... ?
        var options = historyService.getNewQueryOptions();
        var query = historyService.getNewQuery();

        // execute the query
        var result = historyService.executeQuery(query, options);
        var rootNode = result.root;
        rootNode.containerOpen = true;
        // iterate over the immediate children of this folder
        for (var i = 0; i < rootNode.childCount; i++)
        {
            var node = rootNode.getChild(i);
            //liberator.dump("History child " + node.itemId + ": " + node.title + " - " + node.type + "\n");
            if (node.type == node.RESULT_TYPE_URI) // just make sure it's a bookmark
                history.push([node.uri, node.title || "[No title]"]);
        }

        // close a container after using it!
        rootNode.containerOpen = false;
    }

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// MAPPINGS ////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    var modes = liberator.config.browserModes || [liberator.modes.NORMAL];

    liberator.mappings.add(modes,
        ["<C-o>"], "Go to an older position in the jump list",
        function (count) { liberator.history.stepTo(-(count > 1 ? count : 1)); },
        { flags: liberator.Mappings.flags.COUNT });

    liberator.mappings.add(modes,
        ["<C-i>"], "Go to a newer position in the jump list",
        function (count) { liberator.history.stepTo(count > 1 ? count : 1); },
        { flags: liberator.Mappings.flags.COUNT });

    liberator.mappings.add(modes,
        ["H", "<A-Left>", "<M-Left>"], "Go back in the browser history",
        function (count) { liberator.history.stepTo(-(count > 1 ? count : 1)); },
        { flags: liberator.Mappings.flags.COUNT });

    liberator.mappings.add(modes,
        ["L", "<A-Right>", "<M-Right>"], "Go forward in the browser history",
        function (count) { liberator.history.stepTo(count > 1 ? count : 1); },
        { flags: liberator.Mappings.flags.COUNT });

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// COMMANDS ////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    liberator.commands.add(["ba[ck]"],
        "Go back in the browser history",
        function (args, special, count)
        {
            if (special)
            {
                liberator.history.goToStart();
            }
            else
            {
                if (args)
                {
                    var sh = getWebNavigation().sessionHistory;
                    for (var i = sh.index - 1; i >= 0; i--)
                    {
                        if (sh.getEntryAtIndex(i, false).URI.spec == args)
                        {
                            getWebNavigation().gotoIndex(i);
                            return;
                        }
                    }
                    liberator.echoerr("Exxx: URL not found in history");
                }
                else
                {
                    liberator.history.stepTo(count > 0 ? -1 * count : -1);
                }
            }
        },
        {
            completer: function (filter)
            {
                var sh = getWebNavigation().sessionHistory;
                var completions = [];
                for (var i = sh.index - 1; i >= 0; i--)
                {
                    var entry = sh.getEntryAtIndex(i, false);
                    var url = entry.URI.spec;
                    var title = entry.title;
                    if (liberator.completion.match([url, title], filter, false))
                        completions.push([url, title]);
                }
                return [0, completions];
            }
        });

    liberator.commands.add(["fo[rward]", "fw"],
        "Go forward in the browser history",
        function (args, special, count)
        {
            if (special)
            {
                liberator.history.goToEnd();
            }
            else
            {
                if (args)
                {
                    var sh = getWebNavigation().sessionHistory;
                    for (var i = sh.index + 1; i < sh.count; i++)
                    {
                        if (sh.getEntryAtIndex(i, false).URI.spec == args)
                        {
                            getWebNavigation().gotoIndex(i);
                            return;
                        }
                    }
                    liberator.echoerr("Exxx: URL not found in history");
                }
                else
                {
                    liberator.history.stepTo(count > 0 ? count : 1);
                }
            }
        },
        {
            completer: function (filter)
            {
                var sh = getWebNavigation().sessionHistory;
                var completions = [];
                for (var i = sh.index + 1; i < sh.count; i++)
                {
                    var entry = sh.getEntryAtIndex(i, false);
                    var url = entry.URI.spec;
                    var title = entry.title;
                    if (liberator.completion.match([url, title], filter, false))
                        completions.push([url, title]);
                }
                return [0, completions];
            }
        });

    liberator.commands.add(["hist[ory]", "hs"],
        "Show recently visited URLs",
        function (args, special) { liberator.history.list(args, special); },
        { completer: function (filter) { return [0, liberator.history.get(filter)]; } });

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// PUBLIC SECTION //////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    return {

        get: function (filter)
        {
            if (!history)
                load();

            return liberator.completion.filterURLArray(cachedHistory, filter).concat(
                   liberator.completion.filterURLArray(history, filter));
        },

        // the history is automatically added to the Places global history
        // so just update our cached history here
        add: function (url, title)
        {
            if (!history)
                load();

            // don' let cachedHistory grow too large
            if (cachedHistory.length > 1000)
            {
                history = cachedHistory.concat(history);
                cachedHistory = [];
            }
            else
                cachedHistory = cachedHistory.filter(function (elem) { return elem[0] != url; });

            cachedHistory.unshift([url, title || "[No title]"]);
            return true;
        },

        // TODO: better names?
        //       and move to liberator.buffer.?
        stepTo: function (steps)
        {
            var index = getWebNavigation().sessionHistory.index + steps;

            if (index >= 0 && index < getWebNavigation().sessionHistory.count)
            {
                getWebNavigation().gotoIndex(index);
            }
            else
            {
                liberator.beep();
            }
        },

        goToStart: function ()
        {
            var index = getWebNavigation().sessionHistory.index;

            if (index == 0)
            {
                liberator.beep();
                return;
            }

            getWebNavigation().gotoIndex(0);
        },

        goToEnd: function ()
        {
            var index = getWebNavigation().sessionHistory.index;
            var max = getWebNavigation().sessionHistory.count - 1;

            if (index == max)
            {
                liberator.beep();
                return;
            }

            getWebNavigation().gotoIndex(max);
        },

        // if openItems is true, open the matching history items in tabs rather than display
        list: function (filter, openItems)
        {
            var items = this.get(filter);
            if (items.length == 0)
            {
                if (filter.length > 0)
                    liberator.echoerr("E283: No history matching \"" + filter + "\"");
                else
                    liberator.echoerr("No history set");

                return;
            }

            if (openItems)
            {
                return liberator.openTabs((i[0] for (i in items)), items.length);
            }
            else
            {
                var list = ":" + liberator.util.escapeHTML(liberator.commandline.getCommand()) + "<br/>" +
                           "<table><tr align=\"left\" class=\"hl-Title\"><th>title</th><th>URL</th></tr>";
                for (var i = 0; i < items.length; i++)
                {
                    var title = liberator.util.escapeHTML(items[i][1]);
                    if (title.length > 50)
                        title = title.substr(0, 47) + "...";
                    var url = liberator.util.escapeHTML(items[i][0]);
                    list += "<tr><td>" + title + "</td><td><a href=\"#\" class=\"hl-URL\">" + url + "</a></td></tr>";
                }
                list += "</table>";
                liberator.commandline.echo(list, liberator.commandline.HL_NORMAL, liberator.commandline.FORCE_MULTILINE);
            }
        }
    };
    //}}}
}; //}}}

liberator.QuickMarks = function () //{{{
{
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////// PRIVATE SECTION /////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    var qmarks = {};
    // TODO: move to a storage module
    var savedMarks = liberator.options.getPref("extensions.vimperator.quickmarks", "").split("\n");

    // load the saved quickmarks
    for (var i = 0; i < savedMarks.length - 1; i += 2)
    {
        qmarks[savedMarks[i]] = savedMarks[i + 1];
    }

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// MAPPINGS ////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    var modes = liberator.config.browserModes || [liberator.modes.NORMAL];

    liberator.mappings.add(modes,
        ["go"], "Jump to a QuickMark",
        function (arg) { liberator.quickmarks.jumpTo(arg, liberator.CURRENT_TAB); },
        { flags: liberator.Mappings.flags.ARGUMENT });

    liberator.mappings.add(modes,
        ["gn"], "Jump to a QuickMark in a new tab",
        function (arg)
        {
            liberator.quickmarks.jumpTo(arg,
                /\bquickmark\b/.test(liberator.options["activate"]) ?
                liberator.NEW_TAB : liberator.NEW_BACKGROUND_TAB);
        },
        { flags: liberator.Mappings.flags.ARGUMENT });

    liberator.mappings.add(modes,
        ["M"], "Add new QuickMark for current URL",
        function (arg)
        {
            if (/[^a-zA-Z0-9]/.test(arg))
            {
                liberator.beep();
                return;
            }

            liberator.quickmarks.add(arg, liberator.buffer.URL);
        },
        { flags: liberator.Mappings.flags.ARGUMENT });

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// COMMANDS ////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    liberator.commands.add(["delqm[arks]"],
        "Delete the specified QuickMarks",
        function (args, special)
        {
            // TODO: finish arg parsing - we really need a proper way to do this. :)
            if (!special && !args)
            {
                liberator.echoerr("E471: Argument required");
                return;
            }

            if (special && args)
            {
                liberator.echoerr("E474: Invalid argument");
                return;
            }

            if (special)
                liberator.quickmarks.removeAll();
            else
                liberator.quickmarks.remove(args);
        });

    liberator.commands.add(["qma[rk]"],
        "Mark a URL with a letter for quick access",
        function (args)
        {
            var matches = args.string.match(/^([a-zA-Z0-9])(?:\s+(.+))?$/);
            if (!matches)
                liberator.echoerr("E488: Trailing characters");
            else if (!matches[2])
                liberator.quickmarks.add(matches[1], liberator.buffer.URL);
            else
                liberator.quickmarks.add(matches[1], matches[2]);
        },
        { argCount: "+" });

    liberator.commands.add(["qmarks"],
        "Show all QuickMarks",
        function (args)
        {
            // ignore invalid qmark characters unless there are no valid qmark chars
            if (args && !/[a-zA-Z0-9]/.test(args))
            {
                liberator.echoerr("E283: No QuickMarks matching \"" + args + "\"");
                return;
            }

            var filter = args.replace(/[^a-zA-Z0-9]/g, "");
            liberator.quickmarks.list(filter);
        });

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// PUBLIC SECTION //////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    return {

        add: function (qmark, location)
        {
            qmarks[qmark] = location;
        },

        remove: function (filter)
        {
            var pattern = new RegExp("[" + filter.replace(/\s+/g, "") + "]");

            for (var qmark in qmarks)
            {
                if (pattern.test(qmark))
                    delete qmarks[qmark];
            }
        },

        removeAll: function ()
        {
            qmarks = {};
        },

        jumpTo: function (qmark, where)
        {
            var url = qmarks[qmark];

            if (url)
                liberator.open(url, where);
            else
                liberator.echoerr("E20: QuickMark not set");
        },

        list: function (filter)
        {
            var lowercaseMarks = [];
            var uppercaseMarks = [];
            var numberMarks    = [];

            for (var qmark in qmarks)
            {
                if (/[a-z]/.test(qmark))
                    lowercaseMarks.push(qmark);
                else if (/[A-Z]/.test(qmark))
                    uppercaseMarks.push(qmark);
                else
                    numberMarks.push(qmark);
            }

            var marks = lowercaseMarks.sort().concat(uppercaseMarks.sort()).concat(numberMarks.sort());

            if (marks.length == 0)
            {
                liberator.echoerr("No QuickMarks set");
                return;
            }

            if (filter.length > 0)
            {
                marks = marks.filter(function (qmark) {
                    if (filter.indexOf(qmark) > -1)
                        return qmark;
                });

                if (marks.length == 0)
                {
                    liberator.echoerr("E283: No QuickMarks matching \"" + filter + "\"");
                    return;
                }
            }

            var list = ":" + liberator.util.escapeHTML(liberator.commandline.getCommand()) + "<br/>" +
                       "<table><tr align=\"left\" class=\"hl-Title\"><th>QuickMark</th><th>URL</th></tr>";

            for (var i = 0; i < marks.length; i++)
            {
                list += "<tr><td>    " + marks[i] +
                        "</td><td style=\"color: green;\">" + liberator.util.escapeHTML(qmarks[marks[i]]) + "</td></tr>";
            }

            list += "</table>";

            liberator.commandline.echo(list, liberator.commandline.HL_NORMAL, liberator.commandline.FORCE_MULTILINE);
        },

        destroy: function ()
        {
            // save the quickmarks
            var savedQuickMarks = "";

            for (var i in qmarks)
            {
                savedQuickMarks += i + "\n";
                savedQuickMarks += qmarks[i] + "\n";
            }

            liberator.options.setPref("extensions.vimperator.quickmarks", savedQuickMarks);
        }

    };
    //}}}
}; //}}}

// vim: set fdm=marker sw=4 ts=4 et:
