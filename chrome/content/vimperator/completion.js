// The completion substrings, used for showing the longest common match
var g_substrings = [];

/*
 * returns the longest common substring
 * used for the 'longest' setting for wildmode
 *
 */
function get_longest_substring()/*{{{*/
{
    if (g_substrings.length == 0)
        return '';
    var longest = g_substrings[0];
    for (var i = 1; i < g_substrings.length; i++)
    {
        if (g_substrings[i].length > longest.length)
            longest = g_substrings[i];
    }
    //alert(longest);
    return longest;
}/*}}}*/

// function uses smartcase
// list = [ [['com1', 'com2'], 'text'], [['com3', 'com4'], 'text'] ]
function build_longest_common_substring(list, filter)/*{{{*/
{
    var filtered = [];
    //var filter_length = filter.length;
    //filter = filter.toLowerCase();
    var ignorecase = false;
    if(filter == filter.toLowerCase())
        ignorecase = true;

    for (var i = 0; i < list.length; i++)
    {
        for (var j = 0; j < list[i][0].length; j++)
        {
            var item = list[i][0][j];
            if(ignorecase)
                item = item.toLowerCase();

            if (item.indexOf(filter) == -1)
                continue;

            if (g_substrings.length == 0)
            {
                //alert('if: ' + item);
                var last_index = item.lastIndexOf(filter);
                var length = item.length;
                for (var k = item.indexOf(filter); k != -1 && k <= last_index; k = item.indexOf(filter, k + 1))
                {
                    for (var l = k + filter.length; l <= length; l++)
                        g_substrings.push(list[i][0][j].substring(k, l));
                }
            }
            else
            {
                //alert('else: ' + item);
                g_substrings = g_substrings.filter(function($_) {
                    return list[i][0][j].indexOf($_) >= 0;
                });
            }
            filtered.push([list[i][0][j], list[i][1]]);
            break;
        }
    }
    return filtered;
}/*}}}*/

/* this function is case sensitive */
function build_longest_starting_substring(list, filter)/*{{{*/
{
    var filtered = [];
    //var filter_length = filter.length;
    for (var i = 0; i < list.length; i++)
    {
        var command_names = command_long_names(list[i]);
        for (var j = 0; j < command_names.length; j++)
        {
            if (command_names[j].indexOf(filter) != 0)
                continue;
            if (g_substrings.length == 0)
            {
                var length = command_names[j].length;
                for (var k = filter.length; k <= length; k++)
                    g_substrings.push(command_names[j].substring(0, k));
            }
            else
            {
                g_substrings = g_substrings.filter(function($_) {
                    return command_names[j].indexOf($_) == 0;
                });
            }
            filtered.push([command_names[j], list[i][SHORTHELP]]);
            break;
        }
    }
    return filtered;
}/*}}}*/


/* 
 * filter a list of urls
 *
 * may consist of searchengines, filenames, bookmarks and history,
 * depending on the 'complete' option
 * if the 'complete' argument is passed like "h", it temproarily overrides the complete option
 */
function get_url_completions(filter, complete)/*{{{*/
{
    var completions = new Array();
    g_substrings = [];

    var cpt = complete || get_pref("complete");
    // join all completion arrays together
    for (var i = 0; i < cpt.length; i++)
    {
        if (cpt[i] == 's')
            completions = completions.concat(get_search_completions(filter));
        else if (cpt[i] == 'b')
            completions = completions.concat(get_bookmark_completions(filter));
        else if (cpt[i] == 'h')
            completions = completions.concat(get_history_completions(filter));
        else if (cpt[i] == 'f')
            completions = completions.concat(get_file_completions(filter, true));
    }

    return completions;
}/*}}}*/

/* discard all entries in the 'urls' array, which don't match 'filter */
function filter_url_array(urls, filter)/*{{{*/
{
    var filtered = [];
    // completions which don't match the url but just the description
    // list them add the end of the array
    var additional_completions = [];

    if (!filter) return urls.map(function($_) {
        return [$_[0], $_[1]]
    });

    //var filter_length = filter.length;
    var ignorecase = false;
    if(filter == filter.toLowerCase())
        ignorecase = true;

    /*
     * Longest Common Subsequence
     * This shouldn't use build_longest_common_substring
     * for performance reasons, so as not to cycle through the urls twice
     */
    for (var i = 0; i < urls.length; i++)
    {
        var url = urls[i][0] || "";
        var title = urls[i][1] || "";
        if(ignorecase)
        {
            url = url.toLowerCase();
            title = title.toLowerCase();
        }

        if (url.indexOf(filter) == -1)
        {
            if (title.indexOf(filter) != -1)
                additional_completions.push([ urls[i][0], urls[i][1] ]);
            continue;
        }
        if (g_substrings.length == 0)   // Build the substrings
        {
            var last_index = url.lastIndexOf(filter);
            var url_length = url.length;
            for (var k = url.indexOf(filter); k != -1 && k <= last_index; k = url.indexOf(filter, k + 1))
            {
                for (var l = k + filter.length; l <= url_length; l++)
                    g_substrings.push(url.substring(k, l));
            }
        }
        else
        {
            g_substrings = g_substrings.filter(function($_) {
                return url.indexOf($_) >= 0;
            });
        }
        filtered.push([urls[i][0], urls[i][1]]);
    }

    return filtered.concat(additional_completions);
}/*}}}*/

function get_search_completions(filter)/*{{{*/
{
    var engines = vimperator.bookmarks.getSearchEngines().concat(vimperator.bookmarks.getKeywords());

    if (!filter) return engines.map(function($_) {
        return [$_[0], $_[1]];
    });
    var mapped = engines.map(function($_) {
        return [[$_[0]], $_[1]];
    });
    return build_longest_common_substring(mapped, filter);
}/*}}}*/

function get_history_completions(filter)
{
    var items = vimperator.history.get();
    return filter_url_array(items, filter);
}

function get_bookmark_completions(filter)
{
    var bookmarks = vimperator.bookmarks.get();
    return filter_url_array(bookmarks, filter);
}

function get_file_completions(filter)/*{{{*/
{
    //var completions = new Array();
    /* This is now also used as part of the url completion, so the substrings shouldn't be cleared for that case */
    if (!arguments[1])
        g_substrings = [];
    var match = filter.match(/^(.*[\/\\])(.*?)$/);
    var dir;

    if (!match || !(dir = match[1]))
        return [];

    var compl = match[2] || '';
    try {
        var fd = fopen(dir, "<");
    } catch(e) {
        // thrown if file does not exist
        return [ ];
    }

    if (!fd)
        return [];

    var entries = fd.read();
    var delim = fd.path.length == 1 ? '' : (fd.path.search(/\\/) != -1) ? "\\" : "/";
    var new_filter = fd.path + delim + compl;
    if (!filter) return entries.map(function($_) {
        var path = $_.path;
        if ($_.isDirectory()) path += '/';
        return [path, ''];
    });
    var mapped = entries.map(function($_) {
        var path = $_.path;
        if ($_.isDirectory()) path += '/';
        return [[path], ''];
    });

    return build_longest_starting_substring(mapped, new_filter);
}/*}}}*/

function get_help_completions(filter)/*{{{*/
{
    var help_array = [];
    g_substrings = [];
    help_array = help_array.concat(g_commands.map(function($_) {
        return [
                $_[COMMANDS].map(function($_) { return ":" + $_; }),
                $_[SHORTHELP]
            ];
    }));
    settings = get_settings_completions(filter, true);
    help_array = help_array.concat(settings.map(function($_) {
        return [
                $_[COMMANDS].map(function($_) { return "'" + $_ + "'"; }),
                $_[1]
            ];
    }));
    help_array = help_array.concat(g_mappings.map(function($_) {
        return [ $_[COMMANDS], $_[SHORTHELP] ];
    }));

    if (!filter) return help_array.map(function($_) {
        return [$_[COMMANDS][0], $_[1]]; // unfiltered, use the first command
    });

    return build_longest_common_substring(help_array, filter);
}/*}}}*/

function get_command_completions(filter)/*{{{*/
{
    //g_completions = [];
    g_substrings = [];
    if (!filter) return g_commands.map(function($_) {
        return [command_name($_), $_[SHORTHELP]];
    });
    return build_longest_starting_substring(g_commands, filter);
}/*}}}*/

function get_settings_completions(filter, unfiltered)/*{{{*/
{
    g_substrings = [];
    var settings_completions = [];
    var no_mode = false;
    if (filter.indexOf("no") == 0) // boolean option
    {
        no_mode = true;
        filter = filter.substr(2);
    }
    if (unfiltered) return g_settings.filter(function($_) {
        if (no_mode && $_[TYPE] != "boolean") return false;
        else return true;
    }).map(function($_) {
        return [$_[COMMANDS], $_[SHORTHELP]];
    });
    if (!filter) return g_settings.filter(function($_) {
        if (no_mode && $_[TYPE] != "boolean") return false;
        else return true;
    }).map(function($_) {
        return [$_[COMMANDS][0], $_[SHORTHELP]];
    });


    // check if filter ends with =, then complete current value
    else if(filter.length > 0 && filter.lastIndexOf("=") == filter.length -1)
    {
        filter = filter.substr(0, filter.length-1);
        for(var i=0; i<g_settings.length; i++)
        {
            for(var j=0; j<g_settings[i][COMMANDS].length; j++)
            {
                if (g_settings[i][COMMANDS][j] == filter)
                {
                    settings_completions.push([filter + "=" + g_settings[i][GETFUNC].call(this), ""]);
                    return settings_completions;
                }
            }
        }
        return settings_completions;
    }

    // can't use b_l_s_s, since this has special requirements (the prefix)
    var filter_length = filter.length;
    for (var i = 0; i < g_settings.length; i++)
    {
        if (no_mode && g_settings[i][TYPE] != "boolean")
            continue;

        var prefix = no_mode ? 'no' : '';
        for (var j = 0; j < g_settings[i][COMMANDS].length; j++)
        {
            if (g_settings[i][COMMANDS][j].indexOf(filter) != 0) continue;
            if (g_substrings.length == 0)
            {
                var length = g_settings[i][COMMANDS][j].length;
                for (var k = filter_length; k <= length; k++)
                    g_substrings.push(prefix + g_settings[i][COMMANDS][j].substring(0, k));
            }
            else
            {
                g_substrings = g_substrings.filter(function($_) {
                    return g_settings[i][COMMANDS][j].indexOf($_) == 0;
                });
            }
            settings_completions.push([prefix + g_settings[i][COMMANDS][j], g_settings[i][SHORTHELP]]);
            break;
        }
    }

    return settings_completions;
}/*}}}*/

function get_buffer_completions(filter)/*{{{*/
{
    g_substrings = [];
    var items = [];
    var num = getBrowser().browsers.length;
    var title, url;

    for (var i = 0; i < num; i++)
    {
        try
        {
            title = getBrowser().getBrowserAtIndex(i).contentDocument.getElementsByTagName('title')[0].text;
        }
        catch (e)
        {
            title = "";
        }

        url = getBrowser().getBrowserAtIndex(i).contentDocument.location.href;

        if (title.indexOf(filter) == -1 && url.indexOf(filter) == -1)
            continue;

        
        if (title.indexOf(filter) != -1 || url.indexOf(filter) != -1)
        {
            if (title == "")
                title = "(Untitled)";
            items.push([[(i + 1) + ": " + title, (i + 1) + ": " + url], url]);
        }
    }
    if (!filter) return items.map(function($_) {
        return [$_[0][0], $_[1]];
    });
    return build_longest_common_substring(items, filter);
}/*}}}*/

function exTabCompletion(str)
{
	var [count, cmd, special, args] = tokenize_ex(str);
	var completions = new Array;
	var start = 0;
	var s = 0; //FIXME, command specific start setting

	// if there is no space between the command name and the cursor
	// then get completions of the command name
	var matches = str.match(/^(:*\d*)\w*$/);
	if(matches)
	{
		completions = get_command_completions(cmd);
		start = matches[1].length;
	}
	else // dynamically get completions as specified in the g_commands array
	{
		var command = get_command(cmd);
		if (command && command[COMPLETEFUNC])
		{
			completions = command[COMPLETEFUNC].call(this, args);
//			if (command[COMMANDS][0] == "open" ||
//					command[COMMANDS][0] == "tabopen" ||
//					command[COMMANDS][0] == "winopen")
//				start = str.search(/^:*\d*\w+(\s+|.*\|)/); // up to the last | or the first space
//			else
			matches = str.match(/^:*\d*\w+\s+/); // up to the first spaces only
			start = matches[0].length;
		}
	}
	return [start, completions];
}

// vim: set fdm=marker sw=4 ts=4 et:
