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

(c) 2006-2007: Martin Stubenschrott <stubenschrott@gmx.net>

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

vimperator.util = {
    escapeHTML: function(str)
    {
        // XXX: the following code is _much_ slower than a simple .replace()
        // :history display went down from 2 to 1 second after changing
        //
        // var e = window.content.document.createElement("div");
        // e.appendChild(window.content.document.createTextNode(str));
        // return e.innerHTML;
        return str.replace("&", "&amp;", "g").replace("<", "&lt;", "g").replace(">", "&gt;", "g");
    },

    // TODO: use :highlight color groups
    // if "process_strings" is true, any passed strings will be surrounded by " and
    // any line breaks are displayed as \n
    colorize: function(arg, process_strings)
    {
        var type = typeof(arg);

        if (type == "number")
        {
            return "<span style=\"color: red;\">" + arg + "</span>";
        }
        else if (type == "string")
        {
            if (process_strings)
                arg = '"' + vimperator.util.escapeHTML(arg.replace(/\n/, "\\n")) + '"';

            return "<span style=\"color: green;\">" + arg + "</span>";
        }
        else if (type == "boolean")
        {
            return "<span style=\"color: blue;\">" + arg + "</span>";
        }
        else if (arg == null || arg == "undefined")
        {
            return "<span style=\"color: blue;\">" + arg + "</span>";
        }
        else if (type == "object" || type == "function")
        {
            // for java packages value.toString() would crash so badly
            // that we cannot even try/catch it
            if (/^\[JavaPackage.*\]$/.test(arg))
                return "[JavaPackage]";

            var str = arg.toString();
            if (typeof str == "string")  // can be "undefined"
                return vimperator.util.escapeHTML(str);
            else
                return "undefined";
        }

        return arg;
    },

    highlightURL: function(str, force)
    {
        if (force || /^[a-zA-Z]+:\/\/.*\//.test(str))
            return "<a class='hl-URL' href='" + str + "'>" + vimperator.util.escapeHTML(str) + "</a>";
        else
            return str;
    },

    formatNumber: function(num)
    {
        var strNum = (num + "").split(".", 2);

        for (var u = strNum[0].length - 3; u > 0; u -= 3)
            strNum[0] = strNum[0].substring(0, u) + "," + strNum[0].substring(u, strNum[0].length);

        if (strNum[1])
            strNum[0] += "." + strNum[1]

        return strNum[0];
    }
}

// vim: set fdm=marker sw=4 ts=4 et:
