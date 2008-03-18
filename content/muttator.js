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

liberator.config = {
    /*** required options, no checks done if they really exist, so be careful ***/
    name: "Muttator",
    hostApplication: "Thunderbird", // TODO: can this be found out otherwise? gBrandBundle.getString("brandShortName");

    /*** optional options, there are checked for existance and a fallback provided  ***/
    features: ["hints", "mail", "marks"],
    guioptions: { m: ["mail-toolbar-menubar2"], T: ["mail-bar2"], f: ["folderPaneBox", "folderpane_splitter"], F: ["folderPaneHeader"] },

    get browserModes() { return [liberator.modes.MESSAGE]; },
	get mainWidget() { return GetThreadTree(); }, // focusContent() focuses this widget
	mainWindowID: "messengerWindow", // used for :set titlestring

    dialogs: [
        /*["about",            "About Firefox", 
            function() { openDialog("chrome://browser/content/aboutDialog.xul", "_blank", "chrome,dialog,modal,centerscreen"); }],
        ["addons",           "Manage Add-ons",
            function() { BrowserOpenAddonsMgr(); }],*/
        ["checkupdates",     "Check for updates",
            function() { checkForUpdates(); }],
        /*["cleardata",        "Clear private data",
         function() { Cc[GLUE_CID].getService(Ci.nsIBrowserGlue).sanitize(window || null); }],*/
        ["console",          "JavaScript console",
            function() { toJavaScriptConsole(); }],
        /*["customizetoolbar", "Customize the Toolbar",
            function() { BrowserCustomizeToolbar(); }],*/
        ["dominspector",     "DOM Inspector",
            function() { inspectDOMDocument(content.document); }],
        ["downloads",        "Manage Downloads",
            function() { toOpenWindowByType('Download:Manager', 'chrome://mozapps/content/downloads/downloads.xul', 'chrome,dialog=no,resizable'); }],
        /*["import",           "Import Preferences, Bookmarks, History, etc. from other browsers",
            function() { BrowserImport(); }],
        ["openfile",         "Open the file selector dialog",
            function() { BrowserOpenFileWindow(); }],
        ["pageinfo",         "Show information about the current page",
            function() { BrowserPageInfo(); }],
        ["pagesource",       "View page source",
            function() { BrowserViewSourceOfDocument(content.document); }],
        ["preferences",      "Show Firefox preferences dialog",
            function() { openPreferences(); }],
        ["printpreview",     "Preview the page before printing",
            function() { PrintUtils.printPreview(onEnterPrintPreview, onExitPrintPreview); }],*/
        ["printsetup",       "Setup the page size and orientation before printing",
            function() { PrintUtils.showPageSetup(); }],
        ["print",            "Show print dialog",
            function() { PrintUtils.print(); }],
        ["saveframe",        "Save frame to disk",
            function() { saveFrameDocument(); }],
        ["savepage",         "Save page to disk",
            function() { saveDocument(window.content.document); }],
        /*["searchengines",    "Manage installed search engines",
            function() { openDialog("chrome://browser/content/search/engineManager.xul", "_blank", "chrome,dialog,modal,centerscreen"); }],
        ["selectionsource",  "View selection source",
            function() { liberator.buffer.viewSelectionSource(); }]*/
    ],

    init: function()
    {
        liberator.mappings.add([liberator.modes.NORMAL],
            ["o"], "Open a message",
            function () { liberator.commandline.open(":", "open ", liberator.modes.EX); });
    }
}

// vim: set fdm=marker sw=4 ts=4 et:
