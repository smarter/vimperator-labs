/***** BEGIN LICENSE BLOCK ***** {{{
 ©2008 Kris Maglione <maglione.k at Gmail>
 Distributable under the terms of the MIT license, which allows
 for sublicensing under any compatible license, including the MPL,
 GPL, and MPL. Anyone who changes this file is welcome to relicense
 it under any or all of those licenseses.
}}} ***** END LICENSE BLOCK *****/

Highlights.prototype.CSS = <![CDATA[
    Boolean     color: red;
    Function    color: navy;
    Null        color: blue;
    Number      color: blue;
    Object      color: maroon;
    String      color: green;

    Normal      color: black; background: white;
    ErrorMsg    color: white; background: red; font-weight: bold;
    InfoMsg     color: black; background: white;
    ModeMsg     color: black; background: white;
    MoreMsg     color: green; background: white;
    WarningMsg  color: red; background: white;
    Message     white-space: normal; min-width: 100%; padding-left: 2em; text-indent: -2em; display: block;
    NonText     color: blue; min-height: 16px; padding-left: 2px;
    Preview     color: gray;

    CompGroup
    CompGroup:not(:first-of-type) margin-top: .5em;
    CompTitle          color: magenta; background: white; font-weight: bold;
    CompTitle>*        /* border-bottom: 1px dashed magenta; */
    CompMsg            font-style: italic; margin-left: 16px;
    CompItem
    CompItem[selected] background: yellow;
    CompItem>*         padding: 0 .5ex;
    CompIcon           width: 16px; min-width: 16px; display: inline-block; margin-right: .5ex;
    CompIcon>img       max-width: 16px; max-height: 16px; vertical-align: middle;
    CompResult         width: 45%; overflow: hidden;
    CompDesc           color: gray; width: 50%;
    CompLess           text-align: center; height: 0;    line-height: .5ex; padding-top: 1ex;
    CompLess::after    content: "\2303" /* Unicode up arrowhead */
    CompMore           text-align: center; height: .5ex; line-height: .5ex; margin-bottom: -.5ex;
    CompMore::after    content: "\2304" /* Unicode down arrowhead */

    Gradient        height: 1px; margin-bottom: -1px; margin-top: -1px;
    GradientLeft    background-color: magenta;
    GradientRight   background-color: white;

    Indicator   color: blue;
    Filter      font-weight: bold;

    Keyword     color: red;
    Tag         color: blue;

    LineNr      color: orange; background: white;
    Question    color: green; background: white; font-weight: bold;

    StatusLine       color: white; background: black;
    StatusLineBroken color: black; background: #FF6060; /* light-red */
    StatusLineSecure color: black; background: #B0FF00; /* light-green */

    TabClose
    TabIcon
    TabText
    TabNumber      font-weight: bold; margin: 0px; padding-right: .3ex;
    TabIconNumber {
        font-weight: bold;
        color: white;
        text-align: center;
        text-shadow: black -1px 0 1px, black 0 1px 1px, black 1px 0 1px, black 0 -1px 1px;
    }

    Title       color: magenta; background: white; font-weight: bold;
    URL         text-decoration: none; color: green; background: inherit;
    URL:hover   text-decoration: underline; cursor: pointer;

    FrameIndicator,,* {
        background-color: red;
        opacity: 0.5;
        z-index: 999;
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
    }

    Bell         border: none; background-color: black;
    Hint,,* {
        font-family: monospace;
        font-size: 10px;
        font-weight: bold;
        color: white;
        background-color: red;
        border-color: ButtonShadow;
        border-width: 0px;
        border-style: solid;
        padding: 0px 1px 0px 1px;
    }
    Hint::after,,*  content: attr(number);
    HintElem,,*     background-color: yellow;  color: black;
    HintActive,,*   background-color: #88FF00; color: black;
    HintImage,,*    opacity: .5;

    Search,,* {
        font-size: inherit;
        padding: 0;
        color: black;
        background-color: yellow;
        padding: 0;
    }
    ]]>.toString();
function Highlights(name, store, serial)
{
    var self = this;
    var highlight = {};
    var styles = storage.styles;

    const Highlight = Struct("class", "selector", "filter", "default", "value");
    Highlight.defaultValue("filter", function () "chrome://liberator/content/buffer.xhtml" + "," + config.styleableChrome);
    Highlight.defaultValue("selector", function () self.selector(this.class));
    Highlight.defaultValue("value", function () this.default);
    Highlight.prototype.toString = function () "Highlight(" + this.class + ")\n\t" + [k + ": " + util.escapeString(v || "undefined") for ([k, v] in this)].join("\n\t");

    function keys() [k for ([k, v] in Iterator(highlight))].sort();
    this.__iterator__ = function () (highlight[v] for ([k, v] in Iterator(keys())));

    this.get = function (k) highlight[k];
    this.set = function (key, newStyle, force, append)
    {
        let [, class, selectors] = key.match(/^([a-zA-Z_-]+)(.*)/);

        if (!(class in highlight))
            return "Unknown highlight keyword: " + class;

        let style = highlight[key] || new Highlight(key);
        styles.removeSheet(style.selector, null, null, null, true);

        if (append)
            newStyle = (style.value || "").replace(/;?\s*$/, "; " + newStyle);
        if (/^\s*$/.test(newStyle))
            newStyle = null;
        if (newStyle == null)
        {
            if (style.default == null)
            {
                delete highlight[style.class];
                styles.removeSheet(style.selector, null, null, null, true);
                return null;
            }
            newStyle = style.default;
            force = true;
        }

        let css = newStyle.replace(/(?:!\s*important\s*)?(?:;?\s*$|;)/g, "!important;")
                          .replace(";!important;", ";", "g"); // Seeming Spidermonkey bug
        css = style.selector + " { " + css + " }";

        let error = styles.addSheet(style.selector, style.filter, css, true, force);
        if (error)
            return error;
        style.value = newStyle;
        highlight[style.class] = style;
    }

    this.selector = function (class)
    {
        let [, hl, rest] = class.match(/^(\w*)(.*)/);
        return "[liberator|highlight~=" + hl + "]" + rest
    };

    this.reload = function ()
    {
        this.CSS.replace(/\{((?:.|\n)*?)\}/g, function (_, _1) _1.replace(/\n\s*/g, " "))
                    .split("\n").filter(function (s) /\S/.test(s))
                    .forEach(function (style)
        {
            style = Highlight.apply(Highlight, Array.slice(style.match(/^\s*([^,\s]+)(?:,([^,\s]+)?)?(?:,([^,\s]+))?\s*(.*)$/), 1));
            let old = highlight[style.class];
            highlight[style.class] = style;
            if (old && old.value != old.default)
                style.value = old.value;
        });
        for (let [class, hl] in Iterator(highlight))
        {
            if (hl.value == hl.default)
                this.set(class);
        }
    }
}

function Styles(name, store, serial)
{
    /* Can't reference liberator or Components inside Styles --
     * they're members of the window object, which disappear
     * with this window.
     */
    const util = modules.util;
    const sleep = liberator.sleep;
    const storage = modules.storage;
    const consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                     .getService(Components.interfaces.nsIConsoleService);
    const ios = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService);
    const sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
                          .getService(Components.interfaces.nsIStyleSheetService);
    const namespace = '@namespace html "' + XHTML + '";\n' +
                      '@namespace xul "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";\n' +
                      '@namespace liberator "' + NS.uri + '";\n';
    const Sheet = new Struct("name", "sites", "css", "ref");

    let cssUri = function (css) "chrome-data:text/css," + encodeURI(css);

    let userSheets = [];
    let systemSheets = [];
    let userNames = {};
    let systemNames = {};

    this.__iterator__ = function () Iterator(userSheets.concat(systemSheets));
    this.__defineGetter__("systemSheets", function () Iterator(systemSheets));
    this.__defineGetter__("userSheets", function () Iterator(userSheets));
    this.__defineGetter__("systemNames", function () Iterator(systemNames));
    this.__defineGetter__("userNames", function () Iterator(userNames));

    this.addSheet = function (name, filter, css, system, force)
    {
        let sheets = system ? systemSheets : userSheets;
        let names = system ? systemNames : userNames;
        if (name && name in names)
            this.removeSheet(name, null, null, null, system);

        let sheet = sheets.filter(function (s) s.sites.join(",") == filter && s.css == css)[0];
        if (!sheet)
            sheet = new Sheet(name, filter.split(",").filter(util.identity), css, null);

        if (sheet.ref == null) // Not registered yet
        {
            sheet.ref = [];
            try
            {
                this.registerSheet(cssUri(wrapCSS(sheet)), !force);
            }
            catch (e)
            {
                return e.echoerr || e;
            }
            sheets.push(sheet);
        }
        if (name)
        {
            sheet.ref.push(name);
            names[name] = sheet;
        }
        return null;
    }

    this.findSheets = function (name, filter, css, index, system)
    {
        let sheets = system ? systemSheets : userSheets;
        let names = system ? systemNames : userNames;

        // Grossly inefficient.
        let matches = [k for ([k, v] in Iterator(sheets))];
        if (index)
            matches = String(index).split(",").filter(function (i) i in sheets);
        if (name)
            matches = matches.filter(function (i) sheets[i] == names[name]);
        if (css)
            matches = matches.filter(function (i) sheets[i].css == css);
        if (filter)
            matches = matches.filter(function (i) sheets[i].sites.indexOf(filter) >= 0);
        return matches.map(function (i) sheets[i]);
    };

    this.removeSheet = function (name, filter, css, index, system)
    {
        let self = this;
        let sheets = system ? systemSheets : userSheets;
        let names = system ? systemNames : userNames;

        if (filter && filter.indexOf(",") > -1)
            return filter.split(",").reduce(
                function (n, f) n + self.removeSheet(name, f, index, system), 0);

        if (filter == undefined)
            filter = "";

        let matches = this.findSheets(name, filter, css, index, system);
        if (matches.length == 0)
            return;

        for (let [,sheet] in Iterator(matches.reverse()))
        {
            if (name)
            {
                if (sheet.ref.indexOf(name) > -1)
                    sheet.ref.splice(sheet.ref.indexOf(name), 1);
                delete names[name];
            }
            if (!sheet.ref.length)
            {
                this.unregisterSheet(cssUri(wrapCSS(sheet)));
                if (sheets.indexOf(sheet) > -1)
                    sheets.splice(sheets.indexOf(sheet), 1);
            }
            if (filter)
            {
                let sites = sheet.sites.filter(function (f) f != filter);
                if (sites.length)
                    this.addSheet(name, sites.join(","), css, system, true);
            }
        }
        return matches.length;
    }

    this.registerSheet = function (uri, doCheckSyntax, reload)
    {
        //dump (uri + "\n\n");
        if (doCheckSyntax)
            checkSyntax(uri);
        if (reload)
            this.unregisterSheet(uri);
        uri = ios.newURI(uri, null, null);
        if (reload || !sss.sheetRegistered(uri, sss.USER_SHEET))
            sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    }

    this.unregisterSheet = function (uri)
    {
        uri = ios.newURI(uri, null, null);
        if (sss.sheetRegistered(uri, sss.USER_SHEET))
            sss.unregisterSheet(uri, sss.USER_SHEET);
    }

    function wrapCSS(sheet)
    {
        let filter = sheet.sites;
        let css = sheet.css;
        if (filter[0] == "*")
            return namespace + css;
        let selectors = filter.map(function (part) (/[*]$/.test(part)   ? "url-prefix" :
                                                    /[\/:]/.test(part)  ? "url"
                                                                        : "domain")
                                            + '("' + part.replace(/"/g, "%22").replace(/[*]$/, "") + '")')
                              .join(", ");
        return namespace + "@-moz-document " + selectors + "{\n" + css + "\n}\n";
    }

    let queryinterface = XPCOMUtils.generateQI([Components.interfaces.nsIConsoleListener]);
    /* What happens if more than one thread tries to use this? */
    let testDoc = document.implementation.createDocument(XHTML, "doc", null);
    function checkSyntax(uri)
    {
        let errors = [];
        let listener = {
            QueryInterface: queryinterface,
            observe: function (message)
            {
                try
                {
                    message = message.QueryInterface(Components.interfaces.nsIScriptError);
                    if (message.sourceName == uri)
                        errors.push(message);
                }
                catch (e) {}
            }
        };

        try
        {
            consoleService.registerListener(listener);
            if (testDoc.documentElement.firstChild)
                testDoc.documentElement.removeChild(testDoc.documentElement.firstChild);
            testDoc.documentElement.appendChild(util.xmlToDom(
                    <html><head><link type="text/css" rel="stylesheet" href={uri}/></head></html>, testDoc));

            while (true)
            {
                try
                {
                    // Throws NS_ERROR_DOM_INVALID_ACCESS_ERR if not finished loading
                    testDoc.styleSheets[0].cssRules.length;
                    break;
                }
                catch (e)
                {
                    if (e.name != "NS_ERROR_DOM_INVALID_ACCESS_ERR")
                        return [e.toString()];
                    sleep(10);
                }
            }
        }
        finally
        {
            consoleService.unregisterListener(listener);
        }
        if (errors.length)
        {
            let err = new Error("", errors[0].sourceName.replace(/^(chrome-data:text\/css,).*/, "$1..."), errors[0].lineNumber);
            err.name = "CSSError"
            err.message = errors.reduce(function (msg, e) msg + "; " + e.lineNumber + ": " + e.errorMessage,
                errors.shift().errorMessage);
            err.echoerr = err.fileName + ":" + err.lineNumber + ": " + err.message;
            throw err;
        }
    }
}
let (array = util.Array)
{
    Styles.prototype = {
        get sites() array.uniq(array.flatten([v.sites for ([k, v] in this.userSheets)]))
    };
}

const styles = storage.newObject("styles", Styles, false);
const highlight = storage.newObject("highlight", Highlights, false);
highlight.CSS = Highlights.prototype.CSS;
highlight.reload();

liberator.registerObserver("load_commands", function ()
{
    // TODO: :colo default needs :hi clear
    commands.add(["colo[rscheme]"],
        "Load a color scheme",
        function (args)
        {
            let scheme = args[0];

            if (io.sourceFromRuntimePath(["colors/" + scheme + ".vimp"]))
                autocommands.trigger("ColorScheme", { name: scheme });
            else
                liberator.echoerr("E185: Cannot find color scheme " + scheme);
        },
        {
            argCount: "1",
            completer: function (context) completion.colorScheme(context)
        });

    commands.add(["sty[le]"],
        "Add or list user styles",
        function (args)
        {
            let [filter, css] = args;
            let name = args["-name"];

            if (!css)
            {
                let list = Array.concat([i for (i in styles.userNames)],
                                        [i for (i in styles.userSheets) if (!i[1].ref.length)]);
                let str = template.tabular(["", "Filter", "CSS"],
                    ["padding: 0 1em 0 1ex; vertical-align: top", "padding: 0 1em 0 0; vertical-align: top"],
                    ([k, v[1].join(","), v[2]]
                     for ([i, [k, v]] in Iterator(list))
                     if ((!filter || v[1].indexOf(filter) >= 0) && (!name || v[0] == name))));
                commandline.echo(str, commandline.HL_NORMAL, commandline.FORCE_MULTILINE);
            }
            else
            {
                if ("-append" in args)
                {
                    let sheet = styles.findSheets(name, null, null, null, false)[0];
                    if (sheet)
                    {
                        filter = sheet.sites.concat(filter).join(",");
                        css = sheet.css.replace(/;?\s*$/, "; " + css);
                    }
                }
                let err = styles.addSheet(name, filter, css, false, args.bang);
                if (err)
                    liberator.echoerr(err);
            }
        },
        {
            bang: true,
            completer: function (context, args) {
                let compl = [];
                if (args.completeArg == 0)
                {
                    try
                    {
                        compl.push([content.location.host, "Current Host"]);
                        compl.push([content.location.href, "Current URL"]);
                    }
                    catch (e) {}
                    context.completions = compl.concat([[s, ""] for each (s in styles.sites)])
                }
                else if (args.completeArg == 1)
                {
                    let sheet = styles.findSheets(args["-name"], null, null, null, false)[0];
                    if (sheet)
                        context.completions = [[sheet.css, "Current Value"]];
                }
            },
            hereDoc: true,
            literal: 1,
            options: [[["-name", "-n"], commands.OPTION_STRING, null, function () [[k, v.css] for ([k, v] in Iterator(styles.userNames))]],
                      [["-append", "-a"], commands.OPTION_NOARG]],
            serial: function () [
                {
                    command: this.name,
                    bang: true,
                    options: sty.name ? { "-name": sty.name } : {},
                    arguments: [sty.sites.join(",")],
                    literalArg: sty.css
                } for ([k, sty] in styles.userSheets)
            ]
        });

    commands.add(["dels[tyle]"],
        "Remove a user stylesheet",
        function (args) {
            styles.removeSheet(args["-name"], args[0], args.literalArg, args["-index"], false);
        },
        {
            completer: function (context) { context.completions = styles.sites.map(function (site) [site, ""]); },
            literal: 1,
            options: [[["-index", "-i"], commands.OPTION_INT, null, function () [[i, <>{s.sites.join(",")}: {s.css.replace("\n", "\\n")}</>] for ([i, s] in styles.userSheets)]],
                      [["-name", "-n"],  commands.OPTION_STRING, null, function () [[k, v.css] for ([k, v] in Iterator(styles.userNames))]]]
        });

    commands.add(["hi[ghlight]"],
        "Set the style of certain display elements",
        function (args)
        {
            let style = <![CDATA[
                ;
                display: inline-block !important;
                position: static !important;
                margin: 0px !important; padding: 0px !important;
                width: 3em !important; min-width: 3em !important; max-width: 3em !important;
                height: 1em !important; min-height: 1em !important; max-height: 1em !important;
                overflow: hidden !important;
            ]]>;
            let [key, css] = args;
            if (!css && !(key && args.bang))
            {
                let str = template.tabular(["Key", "Sample", "CSS"],
                    ["padding: 0 1em 0 0; vertical-align: top", "text-align: center"],
                    ([h.class,
                      <span style={"text-align: center; line-height: 1em;" + h.value + style}>XXX</span>,
                      template.highlightRegexp(h.value, /\b[-\w]+(?=:)/g)]
                        for (h in highlight)
                        if (!key || h.class.indexOf(key) > -1)));
                commandline.echo(str, commandline.HL_NORMAL, commandline.FORCE_MULTILINE);
                return;
            }
            let error = highlight.set(key, css, args.bang, "-append" in args);
            if (error)
                liberator.echoerr(error);
        },
        {
            bang: true,
            // TODO: add this as a standard highlight completion function?
            completer: function (context, args)
            {
                if (args.completeArg == 0)
                    context.completions = [[v.class, ""] for (v in highlight)];
                else if (args.completeArg == 1)
                {
                    let hl = highlight.get(args[0]);
                    if (hl)
                        context.completions = [[hl.value, "Current Value"], [hl.default || "", "Default Value"]];
                }
            },
            hereDoc: true,
            literal: 1,
            options: [[["-append", "-a"], commands.OPTION_NOARG]],
            serial: function () [
                {
                    command: this.name,
                    arguments: [k],
                    literalArg: v
                }
                for ([k, v] in Iterator(highlight))
                if (v.value != v.default)
            ]
        });
});

// vim: set fdm=marker sw=4 ts=4 et:
