/* call the function like this:
   var res = new Object();
   parseBookmarkString("-t tag1,tag2 -T title http://www.orf.at", res);
   res.tags is an array of tags
   res.title is the title or "" if no one was given
   res.url is the url as a string

   returns false, if parsing failed
*/
function parseBookmarkString(str, res)
{
    res.tags = [];
    res.title = null;
    res.url = null;

    var re_title = /^\s*((-t|--title)\s+(\w+|\".*\"))(.*)/;
    var re_tags = /^\s*((-T|--tags)\s+((\w+)(,\w+)*))(.*)/;
    var re_url = /^\s*(\".+\"|\S+)(.*)/;

    var match_tags = null;
    var match_title = null;
    var match_url = null;

    while(!str.match(/^\s*$/))
    {
        /* first check for --tags */
        match_tags = str.match(re_tags);
        if(match_tags != null)
        {
            str = match_tags[match_tags.length-1]; // the last captured parenthesis is the rest of the string
            tags = match_tags[3].split(",");
            res.tags = res.tags.concat(tags);
        }
        else /* then for --titles */
        {

            match_title = str.match(re_title);
            if(match_title != null)
            {
                // only one title allowed
                if (res.title != null)
                    return false;

                str = match_title[match_title.length-1]; // the last captured parenthesis is the rest of the string
                title = match_title[3];
                if(title.charAt(0) == '"')
                    title = title.substring(1,title.length-1);
                res.title = title;
            }
            else /* at last check for an url */
            {
                match_url = str.match(re_url);
                if (match_url != null)
                {
                    // only one url allowed
                    if (res.url != null)
                        return false;

                    str = match_url[match_url.length-1]; // the last captured parenthesis is the rest of the string
                    url = match_url[1];
                    if(url.charAt(0) == '"')
                        url = url.substring(1,url.length-1);
                    res.url = url;
                }
                else return false; // no url, tag or title found but still text left, abort
            }
        }
    }
    return true;
}

/*
 * also includes methods for dealing with
 * keywords and search engines
 */
function Bookmarks()
{
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////// PRIVATE SECTION /////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    const search_service = Components.classes["@mozilla.org/browser/search-service;1"].
                           getService(Components.interfaces.nsIBrowserSearchService);
    const rdf_service    = Components.classes["@mozilla.org/rdf/rdf-service;1"].
                           getService( Components.interfaces.nsIRDFService );
    
    var bookmarks = null;
    var keywords = null;

    if(get_pref("preload"))
        setTimeout(function() { load(); } , 100);

    function load()
    {
        // update our bookmark cache
        var root = rdf_service.GetResource("NC:BookmarksRoot");
        bookmarks  = new Array(); // also clear our bookmark cache
        keywords   = new Array();

        var bmarks = [];   // here getAllChildren will store the bookmarks
        BookmarksUtils.getAllChildren(root, bmarks);
        for(var bm in bmarks)
        {
            if (bmarks[bm][0] && bmarks[bm][1])
                bookmarks.push([bmarks[bm][1].Value, bmarks[bm][0].Value ]);

            // keyword
            if(bmarks[bm][1] && bmarks[bm][2])
                keywords.push([bmarks[bm][2].Value, bmarks[bm][0].Value, bmarks[bm][1].Value]);
        }
    }

    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////// PUBLIC SECTION //////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    /*
     * @return a new Array() of our bookmarks
     */
    this.get = function()
    {
        if (!bookmarks)
            load();

        return bookmarks;
    }

    /**
     * @TODO: keyword support
     */
    this.add = function (title, uri, keyword)
    {
        if(!bookmarks)
            load();

        folder = rdf_service.GetResource("NC:BookmarksRoot");
        var rSource = BookmarksUtils.createBookmark(title, uri, keyword, title);
        var selection = BookmarksUtils.getSelectionFromResource(rSource);
        var target = BookmarksUtils.getTargetFromFolder(folder);
        BookmarksUtils.insertAndCheckSelection("newbookmark", selection, target);

        //also update bookmark cache
        bookmarks.unshift([uri, title]);
        return true;
    }

    /* no idea what it does, it Just Works (TM)
     *
     * @returns number of deleted bookmarks
     */
    this.remove = function(url)
    { 
        var deleted = 0;
        if(!url)
            return 0;

        // gNC_NS for trunk, NC_NS for 1.X 
        //try { var pNC_NS; pNC_NS = gNC_NS;} catch (err) { pNC_NS = NC_NS;} 
        if (!BMSVC || !BMDS || !RDF || !gNC_NS) // defined from firefox
            return 0; 

        var curfolder = RDF.GetResource("NC:BookmarksRoot");
        var urlArc = RDF.GetResource(gNC_NS + "URL"); 
        var urlLiteral = RDF.GetLiteral(url);
        if (BMDS.hasArcIn(urlLiteral, urlArc))
        { 
            var bmResources, bmResource, title, uri, type, ptype; 
            bmResources = BMSVC.GetSources(urlArc, urlLiteral, true); 
            while (bmResources.hasMoreElements())
            { 
                bmResource = bmResources.getNext(); 
                type = BookmarksUtils.resolveType(bmResource); 
                if (type != "ImmutableBookmark") { 
                    ptype = BookmarksUtils.resolveType(BMSVC.getParent(bmResource)); 
                    //              alert(type);
                    //              if ( type == "Folder")  // store the current folder
                    //                  curfolder = bmResource;
                    if ( (type == "Bookmark" || type == "IEFavorite") && ptype != "Livemark")
                    { 
                        title = BookmarksUtils.getProperty(bmResource, gNC_NS + "Name"); 
                        uri = BookmarksUtils.getProperty(bmResource, gNC_NS + "URL"); 

                        if (uri == url)
                        {
                            RDFC.Init(BMDS, BMSVC.getParent(bmResource));
                            RDFC.RemoveElement(bmResource, true);
                            deleted++;
                        }
                    } 
                } 
            } 
        } 

        // also update bookmark cache, if we removed at least one bookmark
        if(deleted > 0)
            load();

        return deleted; 
    }

    /* also ensures that each search engine has a vimperator-friendly alias */
    this.getSearchEngines = function()
    {
        var search_engines = new Array();
        var firefox_engines = search_service.getVisibleEngines({ });
        for(var i in firefox_engines)
        {
            if (!firefox_engines[i].alias || !firefox_engines[i].alias.match(/^[a-z0-9_]+$/))
            {
                var alias = firefox_engines[i].name.replace(/^\W*(\w+).*/, "$1").toLowerCase();
                firefox_engines[i].alias = alias;
            }
            search_engines.push([firefox_engines[i].alias, firefox_engines[i].description]);
        }

        return search_engines;
    }

    // format of returned array:
    // [keyword, helptext, url]
    this.getKeywords = function()
    {
        if(!keywords)
            load();

        return keywords;
    }

    // if the engine name is null, it uses the default search engine
    // @returns the url for the search string
    this.getSearchURL = function(text, engine_name)
    {
        var url = null;
        if(!engine_name || engine_name == "")
            engine_name = get_pref("defsearch", "google");

        // first checks the search engines for a match
        var engine = search_service.getEngineByAlias(engine_name);
        if(engine)
        {
            if(text)
                url = engine.getSubmission(text, null).uri.spec;
            else
                url = engine.searchForm;
        }
        else // check for keyword urls
        {
            if(!keywords)
                load();

            for (var i in keywords)
            {
                if(keywords[i][0] == engine_name)
                {
                    if (text == null)
                        text = "";
                    url = keywords[i][2].replace(/%s/g, encodeURIComponent(text));
                    break;
                }
            }
        }

        // if we came here, the engine_name is neither a search engine or URL
        return url;
    }
    logMessage("Bookmarks initialized");
}

function History()
{
    const rdf_service    = Components.classes["@mozilla.org/rdf/rdf-service;1"].
                           getService( Components.interfaces.nsIRDFService );
    const global_history_service = Components.classes["@mozilla.org/browser/global-history;2"].
                           getService(Components.interfaces.nsIRDFDataSource);

    var history = null;

    if(get_pref("preload"))
        setTimeout(function() { load(); } , 100);

    function load()
    {
        history = new Array();

        var historytree = document.getElementById("hiddenHistoryTree");
        if (!historytree)
            return;

        if (historytree.hidden)
        {
            historytree.hidden = false;
            historytree.database.AddDataSource(global_history_service);
        }

        if (!historytree.ref)
            historytree.ref = "NC:HistoryRoot";

        var nameResource = rdf_service.GetResource(gNC_NS + "Name");
        var builder = historytree.builder.QueryInterface(Components.interfaces.nsIXULTreeBuilder);

        var count = historytree.view.rowCount;
        for (var i = count-1; i >= 0; i--)
        {
            var res = builder.getResourceAtIndex(i);
            var url = res.Value;
            var title;
            var titleRes = historytree.database.GetTarget(res, nameResource, true);
            if (!titleRes)
                continue;

            var titleLiteral = titleRes.QueryInterface(Components.interfaces.nsIRDFLiteral);
            if(titleLiteral)
                title = titleLiteral.Value;
            else
                title = "";

            history.push([url, title]);
        }
    }
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////// PUBLIC SECTION //////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    /*
     * @return a new Array() of our bookmarks
     */
    this.get = function()
    {
        if (!history)
            load();

        return history;
    }

    this.add = function (url, title)
    {
        if(!history)
            load();

        // XXX: check if fast enough
        history = history.filter(function(elem) {
                return elem[0] != url;
        });
//        for(var i in history)
//        {
//            if(history[i][0] == url)
//                return;
//        }

        history.unshift([url, title]);
        //history.push([url, title]);
        return true;
    };

    logMessage("History initialized");
}

Vimperator.prototype.quickmarks = new function()
{
    //logObject(vimperator);
    //setTimeout(function() {logObject(vimperator)}, 1000);
    //Vimperator.echo("test");
    //alert(vimperator.getpr("hinttags"));
    this.add = function() { alert('add');};
    this.rem = function() { vimperator.echo("rem"); logObject(vimperator)};

    logMessage("quickmarks initialized.");
}


function QM()
{
    //logObject(vimperator);
    //logMessage(vimperator.getpr("complete"));

    this.add = function() { alert('add');};
    this.rem = function() { vimperator.echo("rem"); logObject(vimperator)};
    this.zoom = function() { vimperator.zoom_to(200); logObject(vimperator)};

    logMessage("QM initialized.");
}



// vim: set fdm=marker sw=4 ts=4 et:
