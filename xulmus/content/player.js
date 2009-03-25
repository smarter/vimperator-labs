// Import Artist List as this can be huge

var artists = getArtistsArray();

function Player() // {{{
{
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////// PRIVATE SECTION /////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    // Get the focus to the visible playlist first
    //window._SBShowMainLibrary();

    // interval (milliseconds)
    function seek(interval, direction)
    {
        let position = gMM.playbackControl ? gMM.playbackControl.position : 0;
        player.seekTo(position + (direction ? interval : -interval));
    }

    function focusTrack(mediaItem)
    {
        SBGetBrowser().mediaTab.mediaPage.highlightItem(_SBGetCurrentView().getIndexForItem(mediaItem));
    }

    var mediaCoreListener = {
        onMediacoreEvent: function (event)
        {
            switch (event.type)
            {
                case Ci.sbIMediacoreEvent.BEFORE_TRACK_CHANGE:
                    liberator.log("Before track changed: " + event.data);
                    autocommands.trigger("TrackChangePre", { track: event.data });
                    break;
                case Ci.sbIMediacoreEvent.TRACK_CHANGE:
                    autocommands.trigger("TrackChange", { track: event.data });
                    break;
                case Ci.sbIMediacoreEvent.BEFORE_VIEW_CHANGE:
                    liberator.log("Before view changed: " + event.data);
                    autocommands.trigger("ViewChangePre", { view: event.data });
                    break;
                case Ci.sbIMediacoreEvent.VIEW_CHANGE:
                    liberator.log("View changed: " + event.data);
                    autocommands.trigger("ViewChange", { view: event.data });
                    break;
                case Ci.sbIMediacoreEvent.STREAM_START:
                    liberator.log("Track started: " + event.data);
                    autocommands.trigger("StreamStart", {});
                    break;
                case Ci.sbIMediacoreEvent.STREAM_PAUSE:
                    liberator.log("Track paused: " + event.data);
                    autocommands.trigger("StreamPause", {});
                    break;
                case Ci.sbIMediacoreEvent.STREAM_END:
                    liberator.log("Track ended: " + event.data);
                    autocommands.trigger("StreamEnd", {});
                    break;
                case Ci.sbIMediacoreEvent.STREAM_STOP:
                    liberator.log("Track stopped: " + event.data);
                    autocommands.trigger("StreamStop", {});
                    break;
            }
        }
    };

    gMM.addListener(mediaCoreListener);
    liberator.registerObserver("shutdown", function () {
        gMM.removeListener(mediaCoreListener);
    });

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// MAPPINGS ////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    mappings.add([modes.PLAYER],
        ["x"], "Play track",
        function () { player.play(); });

    mappings.add([modes.PLAYER],
        ["z"], "Previous track",
        function () { player.previous(); });

    mappings.add([modes.PLAYER],
        ["c"], "Pause/unpause track",
        function () { player.togglePlayPause(); });

    mappings.add([modes.PLAYER],
        ["b"], "Next track",
        function () { player.next(); });

    mappings.add([modes.PLAYER],
        ["v"], "Stop track",
        function () { player.stop(); });

    mappings.add([modes.PLAYER],
        ["f"], "Filter library",
        function () { commandline.open(":", "filter ", modes.EX); });

    mappings.add([modes.PLAYER],
        ["F"], "Loads current view filtered by the keywords",
        function () { commandline.open(":", "Filter ", modes.EX); });

    mappings.add([modes.PLAYER],
        ["i"], "Select current track",
        function () { gSongbirdWindowController.doCommand("cmd_find_current_track"); });

    mappings.add([modes.PLAYER],
        ["s"], "Toggle shuffle",
        function () { player.toggleShuffle(); });

    mappings.add([modes.PLAYER],
        ["r"], "Toggle repeat",
        function () { player.toggleRepeat(); });

    mappings.add([modes.PLAYER],
        ["h", "<Left>"], "Seek -10s",
        function (count) { player.seekBackward(Math.max(1, count) * 10000); },
        { flags: Mappings.flags.COUNT });

    mappings.add([modes.PLAYER],
        ["l", "<Right>"], "Seek +10s",
        function (count) { player.seekForward(Math.max(1, count) * 10000); },
        { flags: Mappings.flags.COUNT });

    mappings.add([modes.PLAYER],
        ["H"], "Seek -1m",
        function (count) { player.seekBackward(Math.max(1, count) * 60000); },
        { flags: Mappings.flags.COUNT });

    mappings.add([modes.PLAYER],
        ["L"], "Seek +1m",
        function (count) { player.seekForward(Math.max(1, count) * 60000); },
        { flags: Mappings.flags.COUNT });

    mappings.add([modes.PLAYER],
         ["=", "+"], "Increase volume by 10%",
         function () { player.increaseVolume(); });

    mappings.add([modes.PLAYER],
         ["-"], "Decrease volume by 10%",
         function () { player.decreaseVolume(); });

    ////////////////// ///////////////////////////////////////////////////////////}}}
    ////////////////////// COMMANDS ////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    // TODO: presumably this will eventually just filter the library view like cmus? --djk
    commands.add(["f[ilter]"],
        "Filter and play tracks",
        function (args)
        {
            // Store the old view
            // let prev_view = gMM.status.view;
            let library = LibraryUtils.mainLibrary;
            let mainView = library.createView();
            let sqncr = gMM.sequencer;
            let customProps = Cc["@songbirdnest.com/Songbird/Properties/MutablePropertyArray;1"]
                                  .createInstance(Ci.sbIMutablePropertyArray);

            // args
            switch (args.length)
            {
                case 3:
                    customProps.appendProperty(SBProperties.trackName, args[2].toString());
                case 2:
                    customProps.appendProperty(SBProperties.albumName, args[1].toString());
                case 1:
                    customProps.appendProperty(SBProperties.artistName, args[0].toString());
                    break;
                default:
                    break;
            }

            sqncr.playView(mainView, mainView.getIndexForItem(library.getItemsByProperties(customProps).queryElementAt(0, Ci.sbIMediaItem)));
            player.focusPlayingTrack();
        },
        {
            argCount: "+",
            completer: function (context, args) completion.song(context, args)
        });

    commands.add(["F[ilter]"],
            "Filter tracks based on keywords {genre/artist/album/track}",
            function (args)
            {
                let library = LibraryUtils.mainLibrary;
                let view = LibraryUtils.createStandardMediaListView(LibraryUtils.mainLibrary, args.literalArg);

                if (view.length == 0)
                    liberator.echoerr("No Tracks matching the keywords");
                else
                {
                     SBGetBrowser().loadMediaList(LibraryUtils.mainLibrary, null, null, view,
                                                     "chrome://songbird/content/mediapages/filtersPage.xul");
                     // TODO: make this focusTrack work ?
                     focusTrack(view.getItemByIndex(0));
                }
            },
            {
                argCount: "1",
                literal: 0
                //completer: function (context, args) completion.tracks(context, args);
            });

    // TODO: better off as a single command (:player play) or cmus compatible (:player-play)? --djk
    commands.add(["playerp[lay]"],
        "Play track",
        function () { player.play(); });

    commands.add(["playerpa[use]"],
        "Pause/unpause track",
        function () { player.togglePlayPause(); });

    commands.add(["playern[ext]"],
        "Play next track",
        function () { player.next(); });

    commands.add(["playerpr[ev]"],
        "Play previous track",
        function () { player.previous(); });

    commands.add(["players[top]"],
        "Stop track",
        function () { player.stop(); });

    commands.add(["see[k]"],
        "Seek to a track position",
        function (args)
        {
            let arg = args[0];

            // intentionally supports 999:99:99
            if (!/^[+-]?(\d+[smh]?|(\d+:\d\d:|\d+:)?\d{2})$/.test(arg))
            {
                liberator.echoerr("E475: Invalid argument: " + arg);
                return;
            }

            function ms(t, m) Math.abs(parseInt(t, 10) * { s: 1000, m: 60000, h: 3600000 }[m])

            if (/:/.test(arg))
            {
                let [seconds, minutes, hours] = arg.split(":").reverse();
                hours = hours || 0;
                var value = ms(seconds, "s") + ms(minutes, "m") + ms(hours, "h");
            }
            else
            {
                if (!/[smh]/.test(arg.substr(-1)))
                    arg += "s"; // default to seconds

                value = ms(arg.substring(arg, arg.length - 1), arg.substr(-1));
            }

            if (/^[-+]/.test(arg))
                arg[0] == "-" ? player.seekBackward(value) : player.seekForward(value)
            else
                player.seekTo(value)

        },
        { argCount: "1" });

    // TODO: maybe :vol! could toggle mute on/off? --djk
    commands.add(["vol[ume]"],
        "Set the volume",
        function (args)
        {
            let arg = args[0];

            if (!/^[+-]?\d+$/.test(arg))
            {
                liberator.echoerr("E488: Trailing characters");
                return;
            }

            let level = parseInt(arg, 10) / 100;

            if (/^[+-]/.test(arg))
                level = player.volume + level;

            player.volume = Math.min(Math.max(level, 0), 1);
        },
        { argCount: "1" });

    commands.add(["load"],
       "Load a playlist",
       function (args)
       {
            let arg = args.literalArg;

            if (arg)
            {
                // load the selected playlist/smart playlist
                let playlists = player.getPlaylists();

                for ([i, list] in Iterator(playlists))
                {
                    if (util.compareIgnoreCase(arg, list.name) == 0)
                    {
                        SBGetBrowser().loadMediaList(playlists[i]);
                        focusTrack(_SBGetCurrentView().getItemByIndex(0));
                        return;
                    }
                }

                liberator.echoerr("E475: Invalid argument: " + arg);
            }
            else
            {
                // load main library if there are no args
                _SBShowMainLibrary();
            }
       },
       {
            argCount: "?",
            completer: function(context, args) completion.playlist(context, args),
            literal: 0
       });

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// PUBLIC SECTION //////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    return {

        // TODO: check bounds and round, 0 - 1 or 0 - 100?
        get volume() gMM.volumeControl.volume,
        set volume(value)
        {
            gMM.volumeControl.volume = value;
        },

        // FIXME: can't be called from non-media tabs since 840e78
        play: function play()
        {
            // Check if there is any selection in place, else play first item of the visible view.
            if (_SBGetCurrentView().selection.count != 0)
            {
                // Play the selection.
                gMM.sequencer.playView(_SBGetCurrentView(), _SBGetCurrentView().getIndexForItem(_SBGetCurrentView().selection.currentMediaItem));
                focusTrack(gMM.sequencer.currentItem);
            }
            else
            {
                gMM.sequencer.playView(SBGetBrowser().currentMediaListView, 0);
                focusTrack(gMM.sequencer.currentItem);
            }
        },

        stop: function stop()
        {
            gMM.sequencer.stop();
        },

        next: function next()
        {
            gSongbirdWindowController.doCommand("cmd_control_next");
        },

        previous: function previous()
        {
            gSongbirdWindowController.doCommand("cmd_control_previous");
        },

        togglePlayPause: function togglePlayPause()
        {
            gSongbirdWindowController.doCommand("cmd_control_playpause");
            SBGetBrowser().mediaTab.mediaPage.highlightItem(_SBGetCurrentView().getIndexForItem(gMM.sequencer.currentItem));
        },

        toggleShuffle: function toggleShuffle()
        {
            if (gMM.sequencer.mode != gMM.sequencer.MODE_SHUFFLE)
                gMM.sequencer.mode = gMM.sequencer.MODE_SHUFFLE;
            else
                gMM.sequencer.mode = gMM.sequencer.MODE_FORWARD;
        },

        // FIXME: not really toggling - good enough for now.
        toggleRepeat: function toggleRepeat()
        {
            switch (gMM.sequencer.repeatMode)
            {
                case gMM.sequencer.MODE_REPEAT_NONE:
                    gMM.sequencer.repeatMode = gMM.sequencer.MODE_REPEAT_ONE;
                    break;
                case gMM.sequencer.MODE_REPEAT_ONE:
                    gMM.sequencer.repeatMode = gMM.sequencer.MODE_REPEAT_ALL;
                    break;
                case gMM.sequencer.MODE_REPEAT_ALL:
                    gMM.sequencer.repeatMode = gMM.sequencer.MODE_REPEAT_NONE;
                    break;
                default:
                    gMM.sequencer.repeatMode = gMM.sequencer.MODE_REPEAT_NONE;
                    break;
            }
        },

        seekForward: function seekForward(interval)
        {
            seek(interval, true);
        },

        seekBackward: function seekBackward(interval)
        {
            seek(interval, false);
        },

        seekTo: function seekTo(position)
        {
            if (!gMM.playbackControl)
                this.play();

            let min = 0;
            let max = gMM.playbackControl.duration - 5000; // TODO: 5s buffer like cmus desirable?

            gMM.playbackControl.position = Math.min(Math.max(position, min), max);
        },

        // FIXME: 10% ?
        // I think just general increments of say 0.05 might be better --djk
        increaseVolume: function increaseVolume()
        {
            gMM.volumeControl.volume = gMM.volumeControl.volume * 1.1;
        },

        decreaseVolume: function decreaseVolume()
        {
            if (gMM.volumeControl.volume == 0)
                gMM.volumeControl.volume = 0.1;
            else
                gMM.volumeControl.volume = gMM.volumeControl.volume * 0.9;
        },

        focusPlayingTrack :function focusPlayingTrack()
        {
            focusTrack(gMM.sequencer.currentItem);
        },

        listTracks: function listTracks(view)
        {
            //let myView = LibraryUtils.createStandardMediaListView(LibraryUtils.mainLibrary, args);
            let length = view.length;
            let tracksList = [];

            for (let i = 0; i < length; i++)
            {
                let mediaItem = view.getItemByIndex(i);
                let trackName = mediaItem.getProperty(SBProperties.trackName);
                let albumName = mediaItem.getProperty(SBProperties.albumName);
                let artistName = mediaItem.getProperty(SBProperties.artistName);

                tracksList[i] = [trackName, "Album : " + albumName + " Artist : " + artistName];
            }

            return tracksList;
        },

        // TODO: Use this for implementing "/" and "?". -ken
        searchTracks: function searchTracks(args)
        {
            let currentView = _SBGetCurrentView();
            let mediaItemList = currentView.mediaList;
            let search = _getSearchString(currentView);
            let searchString = "";

            if (search != "")
                searchString = args + " " + search;
            else
                searchString = args;

            let myView = LibraryUtils.createStandardMediaListView(mediaItemList, searchString);
            focusTrack(myView.getItemByIndex(0));
        },

        getPlaylists: function getPlaylists()
        {
            let mainLibrary = LibraryUtils.mainLibrary;
            let playlists = [mainLibrary];
            let listener = {
                onEnumerationBegin: function() { },
                onEnumerationEnd: function() { },
                onEnumeratedItem: function(list, item)
                {
                    // FIXME: why are there null items and duplicates?
                    if (!playlists.some(function (list) list.name == item.name) && item.name != null)
                    {
                        playlists.push(item);
                    }
                    return Components.interfaces.sbIMediaListEnumerationListener.CONTINUE;
                }
            };

            mainLibrary.enumerateItemsByProperty("http://songbirdnest.com/data/1.0#isList", "1", listener);

            return playlists;
        },

        // Play track at 'row' in 'playlist'
        playPlaylist: function playPlaylist(playlist, row)
        {
            gMM.sequencer.playView(playlist.createView(), row);
        }
    };
    //}}}
} // }}}

function getArtists()
{
    return this.artists;
}

function getArtistsArray()
{
    var list = LibraryUtils.mainLibrary;

    //  Create an enumeration listener to count each item
    var listener = {
        count: 0,
        onEnumerationBegin: function (aMediaList) {
            this.count = 0;
        },
        onEnumeratedItem: function (aMediaList, aMediaItem) {
            this.count++;
        },
        onEnumerationEnd: function (aMediaList, aStatusCode) {}
    };

    var artistCounts = {};
    var artists = list.getDistinctValuesForProperty(SBProperties.artistName);
    var artist;
    var artistArray = [];
    var i = 0;
    // Count the number of media items for each distinct artist
    while (artists.hasMore())
    {
        artist = artists.getNext();
        artistArray[i] = [artist, artist];
        list.enumerateItemsByProperty(SBProperties.artistName,
            artist,
            listener,
            Ci.sbIMediaList.ENUMERATIONTYPE_LOCKING);
        artistCounts[artist] = listener.count;
        i++;
    }

    //liberator.dump("Count : "+artistCounts.toSource());
    return artistArray;
}

function getAlbums(artist)
{
    var list = LibraryUtils.mainLibrary;
    var albumArray = [], returnArray = [];
    var items = list.getItemsByProperty(SBProperties.artistName, artist).enumerate();
    var i = 0, j = 0;


    while (items.hasMoreElements())
    {
        album = items.getNext().getProperty(SBProperties.albumName);
        albumArray[i] = [album, album];

        if (i == 0)
        {
            returnArray[j] = albumArray[i];
            j++;
        }
        else if (albumArray[i-1].toString() != albumArray[i].toString())
        {
             returnArray[i] = albumArray[i];
             j++;
        }
        i++;
    }

    return returnArray;
}

function getTracks(artist, album)
{
    var list = LibraryUtils.mainLibrary;
    var tracksArray = [];
    var pa = Cc["@songbirdnest.com/Songbird/Properties/MutablePropertyArray;1"]
                 .createInstance(Ci.sbIMutablePropertyArray);
    var i = 0;

    pa.appendProperty(SBProperties.artistName, artist.toString());
    pa.appendProperty(SBProperties.albumName, album.toString());
    var items = list.getItemsByProperties(pa).enumerate();

    while (items.hasMoreElements())
    {
        track = items.getNext().getProperty(SBProperties.trackName);
        tracksArray[i] = [track, track];
        i++;
    }

    return tracksArray;
}

// vim: set fdm=marker sw=4 ts=4 et:
