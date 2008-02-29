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

// Do NOT create instances of this class yourself, use the helper method
// vimperator.mappings.add() instead
vimperator.Map = function (modes, cmds, description, action, extraInfo) //{{{
{
    if (!modes || (!cmds || !cmds.length) || !action)
        return null;

    if (!extraInfo)
        extraInfo = {};

    this.modes = modes;
    // only store keysyms with uppercase modifier strings
    this.names = cmds.map(function (cmd) { return cmd.replace(/[casm]-/g, function (name) { return name.toUpperCase(); });});
    this.action = action;

    this.flags = extraInfo.flags || 0;
    this.description = extraInfo.description || "";
    this.rhs = extraInfo.rhs || null;
    this.noremap = extraInfo.noremap || false;
};

vimperator.Map.prototype = {

    hasName: function (name)
    {
        return this.names.some(function (e) { return e == name; });
    },

    execute: function (motion, count, argument)
    {
        var args = [];

        if (this.flags & vimperator.Mappings.flags.MOTION)
            args.push(motion);
        if (this.flags & vimperator.Mappings.flags.COUNT)
            args.push(count);
        if (this.flags & vimperator.Mappings.flags.ARGUMENT)
            args.push(argument);

        return this.action.apply(this, args);
    }

};
//}}}

vimperator.Mappings = function () //{{{
{
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////// PRIVATE SECTION /////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    var main = []; // default mappings
    var user = []; // user created mappings

    for (var mode in vimperator.modes)
    {
        main[mode] = [];
        user[mode] = [];
    }

    function addMap(map, userMap)
    {
        var where = userMap ? user : main;
        map.modes.forEach(function (mode) { where[mode].push(map); });
    }

    function getMap(mode, cmd, stack)
    {
        var maps = stack[mode];

        for (var i = 0; i < maps.length; i++)
        {
            if (maps[i].hasName(cmd))
                return maps[i];
        }

        return null;
    }

    function removeMap(mode, cmd)
    {
        var maps = user[mode];
        var names;

        for (var i = 0; i < maps.length; i++)
        {
            names = maps[i].names;
            for (var j = 0; j < names.length; j++)
            {
                if (names[j] == cmd)
                {
                    names.splice(j, 1);

                    if (names.length == 0)
                        maps.splice(i, 1);

                    return;
                }
            }
        }
    }

    function mappingsIterator(modes, stack)
    {
        var output;
        var maps = stack[modes[0]];

        for (var i = 0; i < maps.length; i++)
        {
            output = true;
            for (var index = 1; index < modes.length; index++) // check other modes
            {
                output = false; // toggle false, only true whan also found in this mode
                for (var z = 0; z < user[modes[index]].length; z++) // maps
                {
                    // NOTE: when other than user maps, there might be more than only one names[x].
                    //       since only user mappings gets queried here, only names[0] gets checked for equality.
                    if (maps[i].rhs == user[modes[index]][z].rhs && maps[i].names[0] == user[modes[index]][z].names[0])
                    {
                        output = true;
                        break; // found on this mode - check next mode, if there is one, where it could still fail...
                    }
                }
                break; // not found in this mode -> map wont' match all modes...
            }
            if (output)
                yield maps[i];
        }
        throw StopIteration;
    }

    function addMapCommands(char, modes, modeDescription)
    {
        // 0 args -> list all maps
        // 1 arg  -> list the maps starting with args
        // 2 args -> map arg1 to arg*
        function map(args, mode, noremap)
        {
            if (!args)
            {
                vimperator.mappings.list(mode);
                return;
            }

            // ?:\s+ <- don't remember; (...)? optional = rhs
            var [, lhs, rhs] = args.match(/(\S+)(?:\s+(.+))?/);
            var leaderRegexp = /<Leader>/i;

            if (leaderRegexp.test(lhs))
                lhs = lhs.replace(leaderRegexp, vimperator.events.getMapLeader());

            if (!rhs) // list the mapping
            {
                vimperator.mappings.list(mode, lhs);
            }
            else
            {
                for (var index = 0; index < mode.length; index++)
                {
                    vimperator.mappings.addUserMap([mode[index]], [lhs],
                            "User defined mapping",
                            function (count) { vimperator.events.feedkeys((count > 1 ? count : "") + rhs, noremap); },
                            {
                                flags: vimperator.Mappings.flags.COUNT,
                                rhs: rhs,
                                noremap: noremap
                            });
                }
            }
        }

        var modeDescription = modeDescription ? " in " + modeDescription + " mode" : "";

        vimperator.commands.add([char ? char + "m[ap]" : "map"],
            "Map a key sequence" + modeDescription,
            function (args) { map(args, modes, false); });

        vimperator.commands.add([char + "no[remap]"],
            "Map a key sequence without remapping keys" + modeDescription,
            function (args) { map(args, modes, true); });

        vimperator.commands.add([char + "mapc[lear]"],
            "Remove all mappings" + modeDescription,
            function (args)
            {
                if (args)
                {
                    vimperator.echoerr("E474: Invalid argument");
                    return;
                }

                for (let i = 0; i < modes.length; i++)
                    vimperator.mappings.removeAll(modes[i]);
            });

        vimperator.commands.add([char + "unm[ap]"],
            "Remove a mapping" + modeDescription,
            function (args)
            {
                if (!args)
                {
                    vimperator.echoerr("E474: Invalid argument");
                    return;
                }

                var flag = false;
                for (let i = 0; i < modes.length; i++)
                {
                    if (vimperator.mappings.hasMap(modes[i], args))
                    {
                        vimperator.mappings.remove(modes[i], args);
                        flag = true;
                    }
                }
                if (!flag)
                    vimperator.echoerr("E31: No such mapping");
            });
    }

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// COMMANDS ////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    addMapCommands("",  [vimperator.modes.NORMAL], "");
    addMapCommands("c", [vimperator.modes.COMMAND_LINE], "command line");
    addMapCommands("i", [vimperator.modes.INSERT, vimperator.modes.TEXTAREA], "insert");
    if (vimperator.has("mail"))
        addMapCommands("m", [vimperator.modes.MESSAGE], "message");

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// PUBLIC SECTION //////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    // FIXME:
    vimperator.Mappings.flags = {
        ALLOW_EVENT_ROUTING: 1 << 0, // if set, return true inside the map command to pass the event further to firefox
        MOTION:              1 << 1,
        COUNT:               1 << 2,
        ARGUMENT:            1 << 3
    };

    return {

        // NOTE: just normal mode for now
        __iterator__: function ()
        {
            return mappingsIterator([vimperator.modes.NORMAL], main);
        },

        // used by :mkvimperatorrc to save mappings
        getUserIterator: function (mode)
        {
            return mappingsIterator(mode, user);
        },

        add: function (modes, keys, description, action, extra)
        {
            addMap (new vimperator.Map(modes, keys, description, action, extra), false);
        },

        addUserMap: function (modes, keys, description, action, extra)
        {
            var map = new vimperator.Map(modes, keys, description || "User defined mapping", action, extra);

            // remove all old mappings to this key sequence
            for (var i = 0; i < map.names.length; i++)
            {
                for (var j = 0; j < map.modes.length; j++)
                    removeMap(map.modes[j], map.names[i]);
            }

            addMap (map, true);
        },

        get: function (mode, cmd)
        {
            return getMap(mode, cmd, user) || getMap(mode, cmd, main);
        },

        getDefault: function (mode, cmd)
        {
            return getMap(mode, cmd, main);
        },

        // returns an array of mappings with names which START with "cmd" (but are NOT "cmd")
        getCandidates: function (mode, cmd)
        {
            var mappings = user[mode].concat(main[mode]);
            var matches = [];

            for (var i = 0; i < mappings.length; i++)
            {
                var map = mappings[i];
                for (var j = 0; j < map.names.length; j++)
                {
                    if (map.names[j].indexOf(cmd) == 0 && map.names[j].length > cmd.length)
                    {
                        // for < only return a candidate if it doesn't look like a <c-x> mapping
                        if (cmd != "<" || !/^<.+>/.test(map.names[j]))
                            matches.push(map);
                    }
                }
            }

            return matches;
        },

        // returns whether the user added a custom user map 
        hasMap: function (mode, cmd)
        {
            return user[mode].some(function (map) { return map.hasName(cmd); });
        },

        remove: function (mode, cmd)
        {
            removeMap(mode, cmd);
        },

        removeAll: function (mode)
        {
            user[mode] = [];
        },

        list: function (modes, filter)
        {
            // modes means, a map must exist in both modes in order to get listed
            var maps = user[modes[0]]; // duplicate (reference) (first mode where it must match)
            var output = [];

            if (!maps || maps.length == 0)
            {
                vimperator.echo("No mappings found");
                return;
            }

            for (var i = 0; i < maps.length; i++) // check on maps items (first mode)
            {
                output.push(true);
                if (filter && maps[i].names[0] != filter) // does it match the filter first of all?
                {
                    output[output.length - 1] = false;
                    continue;
                }
                for (var index = 1; index < modes.length; index++) // check if found in the other modes (1(2nd)-last)
                {
                    output[output.length - 1] = false; // toggle false, only true whan also found in this mode
                    for (var z = 0; z < user[modes[index]].length; z++) // maps on the other modes
                    {
                        // NOTE: when other than user maps, there might be more than only one names[x].
                        //       since only user mappings gets queried here, only names[0] gets checked for equality.
                        if (maps[i].rhs == user[modes[index]][z].rhs && maps[i].names[0] == user[modes[index]][z].names[0])
                        {
                            output[output.length - 1] = true;
                            break; // found on this mode - ok, check next mode...
                        }
                    }
                    break; // not found in this mode -> map wont' match all modes...
                }
            }

            // anything found?
            var flag = false;
            for (var i = 0; i < output.length; i++)
                if (output[i])
                    flag = true;

            if (!flag)
            {
                vimperator.echo("No mappings found");
                return;
            }

            var modeSign = "";
            for (var i = 0; i < modes.length; i++)
            {
                if (modes[i] == vimperator.modes.NORMAL) 
                    modeSign += 'n';
                if ((modes[i] == vimperator.modes.INSERT || modes[i] == vimperator.modes.TEXTAREA) && modeSign.indexOf("i") == -1) 
                    modeSign += 'i';
                if (modes[i] == vimperator.modes.COMMAND_LINE) 
                    modeSign += 'c';
            }

            var list = "<table>";
            for (i = 0; i < maps.length; i++)
            {
                if (!output[i])
                    continue;
                for (var j = 0; j < maps[i].names.length; j++)
                {
                    list += "<tr>";
                    list += "<td> " + modeSign + "   " + vimperator.util.escapeHTML(maps[i].names[j]) + "</td>";
                    if (maps[i].rhs)
                        list += "<td> "+ (maps[i].noremap ? "*" : " ") + "</td>" 
                                        + "<td>" + vimperator.util.escapeHTML(maps[i].rhs) + "</td>";
                    list += "</tr>";
                }
            }
            list += "</table>";

            vimperator.commandline.echo(list, vimperator.commandline.HL_NORMAL, vimperator.commandline.FORCE_MULTILINE);
        }

    };
}; //}}}

// vim: set fdm=marker sw=4 ts=4 et:
