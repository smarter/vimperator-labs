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

vimperator.Hints = function() //{{{
{
    var linkNumString = ""; // the typed link number is in this string
    var submode = ""; // used for extended mode, can be "o", "t", "y", etc.

    // hints[] = [elem, text, span, elem.style.backgroundColor, elem.style.color]
    var hints = [];
    var valid_hints = []; // store the indices of the "hints" array with valid elements
    
    var canUpdate = true;
    var timeout = 200; // only update every 200ms when typing fast, not used yet

    // this function 'click' an element, which also works
    // for javascript links
    function openHint(new_tab, new_window)
    {
        if (valid_hints.length < 1)
            return false;

        var x = 0, y = 0;
        var elem = valid_hints[0];
        var elemTagName = elem.tagName;
        elem.focus();
        if (elemTagName == 'FRAME' || elemTagName == 'IFRAME')
            return 0;

        // for imagemap
        if (elemTagName == 'AREA')
        {
            var coords = elem.getAttribute("coords").split(",");
            x = Number(coords[0]);
            y = Number(coords[1]);
        }
        doc = window.content.document;
        view = window.document.defaultView;

        var evt = doc.createEvent('MouseEvents');
        evt.initMouseEvent('mousedown', true, true, view, 1, x+1, y+1, 0, 0, /*ctrl*/ new_tab, /*event.altKey*/0, /*event.shiftKey*/ new_window, /*event.metaKey*/ new_tab, 0, null);
        elem.dispatchEvent(evt);

        var evt = doc.createEvent('MouseEvents');
        evt.initMouseEvent('click', true, true, view, 1, x+1, y+1, 0, 0, /*ctrl*/ new_tab, /*event.altKey*/0, /*event.shiftKey*/ new_window, /*event.metaKey*/ new_tab, 0, null);
        elem.dispatchEvent(evt);

        return true;
    };

    function focusHint()
    {
        if (valid_hints.length < 1)
            return false;

        var elem = valid_hints[0];
        var doc = window.content.document;
        if (elem.tagName == 'FRAME' || elem.tagName == 'IFRAME')
        {
            elem.contentWindow.focus();
            return;
        }
        else
        {
            elem.focus();
        }

        var evt = doc.createEvent('MouseEvents');
        var x = 0;
        var y = 0;
        // for imagemap
        if (elem.tagName == 'AREA')
        {
            var coords = elem.getAttribute("coords").split(",");
            x = Number(coords[0]);
            y = Number(coords[1]);
        }

        evt.initMouseEvent('mouseover', true, true, doc.defaultView, 1, x, y, 0, 0, 0, 0, 0, 0, 0, null);
        elem.dispatchEvent(evt);
    };

    function yankHint(text)
    {
        if (valid_hints.length < 1)
            return false;

        if (text)
            var loc = valid_hints[0].href;
        else
            var loc = valid_hints[0].textContent;

        vimperator.copyToClipboard(loc);
        vimperator.echo("Yanked " + loc, vimperator.commandline.FORCE_SINGLELINE);
    };

    function saveHint(skip_prompt)
    {
        if (valid_hints.length < 1)
            return false;

        var elem = valid_hints[0];
        var doc  = elem.ownerDocument;
        var url = makeURLAbsolute(elem.baseURI, elem.href);
        var text = elem.textContent;

        try
        {
            urlSecurityCheck(url, doc.nodePrincipal);
            saveURL(url, text, null, true, skip_prompt, makeURI(url, doc.characterSet));
        }
        catch (e)
        {
            vimperator.echoerr(e);
        }
    }
    
    function generate(win)
    {
        if (!win)
            win = window.content;

        var doc = win.document;

        var baseNodeAbsolute = doc.createElementNS("http://www.w3.org/1999/xhtml", "span");
        baseNodeAbsolute.style.backgroundColor = "red";
        baseNodeAbsolute.style.color = "white";
        baseNodeAbsolute.style.position = "absolute";
        baseNodeAbsolute.style.fontSize = "10px";
        baseNodeAbsolute.style.fontWeight = "bold";
        baseNodeAbsolute.style.lineHeight = "10px";
        baseNodeAbsolute.style.padding = "0px 1px 0px 0px";
        baseNodeAbsolute.style.zIndex = "5000";
        baseNodeAbsolute.className = "vimperator-hint";

        var res = vimperator.buffer.evaluateXPath(vimperator.options["hinttags"], doc, null, true);
        var elem, tagname, text, span, rect;
        vimperator.log("Hinting " + res.snapshotLength + " items on " + doc.title);

        var height = window.content.innerHeight;
        var width  = window.content.innerWidth;
        hints = [];

        for (var i = 0; i < res.snapshotLength; i++)
        {
            elem = res.snapshotItem(i);
            rect = elem.getBoundingClientRect();
            if (!rect || rect.bottom < 0 || rect.top > height || rect.right < 0 || rect.left > width)
                continue;

            rect = elem.getClientRects()[0];
            if (!rect)
                continue;

            tagname = elem.tagName.toLowerCase();
            if (tagname == "input" || tagname == "textarea")
                text = elem.value.toLowerCase();
            else if (tagname == "select")
            {
                if (elem.selectedIndex >= 0)
                    text = elem.item(elem.selectedIndex).text.toLowerCase();
                else
                    text = "";
            }
            else
                text = elem.textContent.toLowerCase();

            span = baseNodeAbsolute.cloneNode(true);
            span.innerHTML = "";
            span.style.display = "none";
            doc.body.appendChild(span);

            hints.push([elem, text, span, elem.style.backgroundColor, elem.style.color]);
        }

        return true;
    }

    //this.show = function(doc, str, start_idx)
    function showHints(win, str, start_idx)
    {
        if (!canUpdate)
            return false;

        if (!win)
            win = window.content;
        if (!str)
            str = "";

        if (win.document.body.localName.toLowerCase() == "frameset")
        {
//        for (i = 0; i < win.frames.length; i++)
//            removeHints(win.frames[i]);
            vimperator.echo("hint support for frameset pages not fully implemented yet");
        }

        vimperator.log("Show hints matching: " + str, 7);

        var doc = win.document;
        var scrollX = doc.defaultView.scrollX;
        var scrollY = doc.defaultView.scrollY;

        var elem, tagname, text, rect, span;
        var hintnum = start_idx > 0 ? start_idx : 1;

        var height = window.content.innerHeight;
        var width  = window.content.innerWidth;
        var find_tokens = str.split(/ +/);
        valid_hints = [];

outer:
        for (var i = 0; i < hints.length; i++)
        {
            elem = hints[i][0];
            text = hints[i][1];
            span = hints[i][2];
            //tagname = elem.tagName.toLowerCase();

            for (var k = 0; k < find_tokens.length; k++)
            {
                if (text.indexOf(find_tokens[k]) < 0)
                {
                    //dump("NOT matching: " + text + "\n");
                    elem.style.backgroundColor = hints[i][3];
                    elem.style.color = hints[i][4];
                    span.style.display = "none";
                    continue outer;
                }
            }
            //dump("MATCHING: " + text + "\n");
            elem.style.backgroundColor = "yellow";
            elem.style.color = "black";
            rect = elem.getClientRects()[0];
            if (rect)
            {
                span.style.left = (rect.left + scrollX) + "px";
                span.style.top = rect.top + scrollY + "px";
                span.innerHTML = "" + (hintnum++);
                span.style.display = "inline";
                valid_hints.push(elem);
                continue;
            }
        }

        vimperator.log("Hinted " + valid_hints.length + " items of " + hints.length + " matching " + str, 7);
        return true;
    }

    function hideHints(win)
    {
        if (!win)
            win = window.content;

        try
        {
            for (var i = 0; i < hints.length; i++)
            {
                // remove the span for the numeric display part
                win.document.body.removeChild(hints[i][2]);

                // restore colors
                var elem = hints[i][0];
                elem.style.backgroundColor = hints[i][3];
                elem.style.color = hints[i][4];
            }
        }
        catch(e) { vimperator.log("Error hiding hints, probably wrong window"); }
    };

    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////// PUBLIC SECTION //////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////

    // TODO: implement framesets
    this.show = function(mode, minor)
    {
        if (mode == vimperator.modes.EXTENDED_HINT && !/^[afoOstTwWyY]$/.test(minor))
        {
            vimperator.beep();
            return;
        }

        vimperator.modes.set(vimperator.modes.HINTS, mode);
        submode = minor;
        linkNumString = "";
        canUpdate = false;

        generate();
        // get all keys from the input queue
        var mt = Components.classes['@mozilla.org/thread-manager;1'].getService().mainThread;
        while (mt.hasPendingEvents())
            mt.processNextEvent(true);
            
        canUpdate = true;
        showHints(null, linkNumString);
        return true;
    };

    // does not end the mode automatically
    this.hide = function()
    {
        hideHints();

        linkNumString = "";
        hints = [];
        valid_hints = [];
        canUpdate = false;

        return 0;
    };

    this.onEvent = function(event)
    {
        var num = String.fromCharCode(event.charCode).toLowerCase();
        linkNumString += "" + num;
        //setTimeout( function() { canUpdate = true; }, timeout);
        vimperator.statusline.updateInputBuffer(linkNumString);
        showHints(null, linkNumString);

        if (valid_hints.length == 0)
            vimperator.beep();
        else if (valid_hints.length >= 1)
        {
            var first_href = valid_hints[0].getAttribute("href") || null;
            if (first_href)
            {
                if (valid_hints.some( function(e) { return e.getAttribute("href") != first_href; } ))
                    return;
            }
            else if (valid_hints.length > 1)
                return;

            vimperator.echo(" ");
            vimperator.statusline.updateInputBuffer("");

            if (vimperator.modes.extended & vimperator.modes.QUICK_HINT)
                openHint(false, false);
            else
            {
                var loc = valid_hints.length > 0 ? valid_hints[0].href : "";
                switch (submode)
                {
                    case "f": focusHint(); break;
                    case "o": openHint(false, false); break;
                    case "O": vimperator.commandline.open(":", "open " + loc, vimperator.modes.EX); break;
                    case "t": openHint(true,  false); break;
                    case "T": openHint(true,  false); break;
                    case "T": vimperator.commandline.open(":", "tabopen " + loc, vimperator.modes.EX); break;
                    case "w": openHint(false, true);  break;
                    case "W": vimperator.commandline.open(":", "winopen " + loc, vimperator.modes.EX); break;
                    case "a": saveHint(false); break;
                    case "s": saveHint(true); break;
                    case "y": yankHint(false); break;
                    case "Y": yankHint(true); break;
                    default:
                        vimperator.echoerr("INTERNAL ERROR: unknown submode: " + submode);
                }
            }

            this.hide();
            // only close this mode half a second later, so we don't trigger accidental actions so easily
            // XXX: currently closes SELECT fields, need have an own mode for that
            setTimeout( function() {
                if (vimperator.mode == vimperator.modes.HINTS)
                    vimperator.modes.reset(true);
            }, 500);
        }
    }


    // FIXME: add resize support
    //window.addEventListener("resize", onResize, null);

   // getBrowser().addEventListener("DOMContentLoaded", function(event) {
   //         if (vimperator.options["autohints"])
   //             vimperator.hints.show(event.target);
   // }, false);

//    function onResize(event)
//    {
//        if (event)
//            doc = event.originalTarget;
//        else
//            doc = window.content.document;
//    }
//
//    this.reshowHints = function()
//    {
//        onResize(null);
//    };
//
//

} //}}}

// vim: set fdm=marker sw=4 ts=4 et:
