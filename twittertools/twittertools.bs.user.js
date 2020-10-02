//jshint curly: false, strict: global, unused: vars, jquery: true
// ==UserScript==
// @name        TwitterTools (bs ver)
// @description Allows downloading of various content on Twitter. Also some Twitter-downloading-related tweaks on other sites.
// @version     0.2.3
// @author      noccu
// @namespace   twitter_fuckery
// @match       http://twitter.com/*
// @match       https://twitter.com/*
// @grant       none
// @run-at      document-start
// @inject-into auto
// ==/UserScript==

//WebExtensions are dumb.

'use strict';
//let twitterTools = `
function twitterTools() {
    'use strict';

    // Webpage -> none
    // This script is automatically called by the extension.
    //TODO: Use proper events instead of status bs

    // Global Script Object
    // Represents state of the script
    function dbgLog() {
        if (TT.debug) TT.console.log(arguments);
    }

    var TT = {
        locations: ttEnum("dash", "profile", "status", "direct", "results", "booru", "tweetdeck"),
        statuses: ttEnum("OK", "ERROR", "LOG"), //Add elevated error for notifying the user.
        imgmodes: ttEnum("base", "thumb", "small", "large", "orig"),
        location: 0,
        status: 0,
        openCont: null,
        page: location.href,
        console: console,
        vidLibrary: {} //tweetID: {type, url}
    };

    //Hack into Twitter requests for data gathering.
    XMLHttpRequest.prototype.realSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (value) {
        this.addEventListener("load", function ic() {
            //find video metadata requests and save the data
            if (/videos\/tweet\/config\/\d+\.json/.test(this.responseURL)) {
                let data = JSON.parse(this.response).track;
                if (data.contentType == "media_entity") {
                    let tweetId = data.expandedUrl.match(/status\/(\d+)\//)[1];
                    if (!TT.vidLibrary[tweetId]) {
                        let type;
                        switch (data.playbackType) {
                            case "video/mp4":
                                type = "mp4";
                                break;
                            case "application/x-mpegURL":
                                type = "ts";
                                break;
                            default:
                                throw "Unknown video type";
                        }
                        TT.vidLibrary[tweetId] = {
                            type,
                            url: data.playbackUrl
                        };
                    }
                }
            }
        }, {
            passive: true,
            once: true
        });
        this.realSend(value);
    };

    // Main function
    (function main() {
        var iv, to;
        // Await jQuery, we need it for a few events cause Twitter uses it.
        new Promise((r, e) => {
                iv = setInterval(() => {
                    if (window.$) r();
                }, 500);
                to = setTimeout(e, 15000);
            })
            .then(() => {
                clearInterval(iv);
                clearTimeout(to);
                ttSetLocation();
                if (!ttOK()) return;
                ttInjectCSS();
                document.addEventListener("click", toggleContainer);
                if (!ttOK()) return;
                handleLocation();
            }, () => clearInterval(iv));
    })();

    // none -> TTStatus
    // Determines where we are so we can see what to do.
    // Sets a global var in our state obj.
    function ttSetLocation() {
        switch (true) {
            case location.host == "twitter.com":
                TT.console = (function () {
                    let i = document.createElement("iframe");
                    i.style.display = "none";
                    try {
                        document.body.appendChild(i);
                    } catch (e) {
                        ttStatusUpdate(TT.statuses.LOG, "Couldn't add console.\n" + e);
                        console.log = console.error;
                        return console;
                    }
                    return i.contentWindow.console;
                })();

                switch (true) {
                    case location.pathname.includes("/status/"):
                        TT.location = TT.locations.status;
                        break;
                    case !location.search && /\/media$|^\/[^\/#]+$/.test(location.pathname):
                        TT.location = TT.locations.profile;
                        break;
                    case location.pathname == "/":
                        TT.location = TT.locations.dash;
                        break;
                    default:
                        TT.location = null;
                        return ttStatusUpdate(TT.statuses.LOG, "Lost on Twitter.");
                }
                break;

            case location.host == "pbs.twimg.com":
                TT.location = TT.locations.direct;
                break;
            default:
                TT.location = TT.error;
                return ttStatusUpdate(TT.statuses.LOG, "Can't determine site URL.");
        }

        return ttStatusUpdate(TT.statuses.OK);
    }

    // none -> TTStatus
    // Fires off different routines depending on the url to process further
    function handleLocation() {
        switch (TT.location) {
            case TT.locations.dash:
            case TT.locations.profile:
                processPage();
                break;
            case TT.locations.status:
                //original/main tweet
                var tweet = document.getElementsByClassName("js-original-tweet")[0];
                processTweetData(parseTweet(tweet));
                let stream = document.getElementById("ancestors") || document.querySelector("div[data-component-context='conversation']"); //optional conversation/reply thread.
                processStream(stream);
                break;
        }

        return ttStatusUpdate(TT.statuses.OK);
    }

    // none -> TTStatus
    function processPage() {
        $(document).one("uiPageChanged", processPage); //Reactive itself upon changes.

        //var timeline = document.getElementById("stream-items-id");
        var timeline = document.getElementById("timeline"); //events are caught on this id only it seems
        //    var timeline = document.getElementById("js-navigable-stream"); //events are caught on this id only it seems
        if (timeline) return processTimeline(timeline);
        else return ttStatusUpdate(TT.statuses.ERROR, "Couldn't find timeline.");
    }

    // Element (Timeline) -> TTStatus
    // Traverse the Timeline tl and process all tweets (per type)
    function processTimeline(tl) {
        //Static processing
        if (tl.dataset.ttProcessed) return ttStatusUpdate(TT.statuses.ERROR, "Already processed this timeline.");
        var tweets = tl.getElementsByClassName("js-stream-tweet");

        for (let tweet of tweets) {
            processTweetData(parseTweet(tweet));
        }

        //Dynamic updating: keep updating on new items
        $(tl).on("uiHasInjectedTimelineItem", processTimelineItem);
        tl.dataset.ttProcessed = true;

        return ttStatusUpdate(TT.statuses.OK);
    }

    function processStream(stream) {
        if (stream.ttProcessed) {
            return ttStatusUpdate(TT.statuses.ERROR, "Already processed this stream.");
        }
        let tweets = stream.getElementsByClassName("js-stream-tweet");

        for (let tweet of tweets) {
            processTweetData(parseTweet(tweet));
        }

        //Dynamic updating: keep updating on new items
        $(stream).on("uiHasInjectedTimelineItem", processTimelineItem);
        stream.ttProcessed = true;

        return ttStatusUpdate(TT.statuses.OK);
    }

    //Event -> TTStatus
    function processTimelineItem(event) {
        let haveTweet = false,
            tweet;
        if (event.target.dataset && event.target.dataset.itemType == "tweet") {
            haveTweet = true;
            tweet = event.target.firstElementChild;
        } else if (event.target.classList.contains("js-stream-tweet")) {
            haveTweet = true;
            tweet = event.target;
        }

        if (!haveTweet) return ttStatusUpdate(TT.statuses.LOG, `Timeline: expected tweet, got ${event.target.dataset.itemType} on `, event.target);

        return processTweetData(parseTweet(tweet));
    }

    // TweetData -> TTStatus
    // Calls the correct function for every Tweet type to handle it further.
    function processTweetData(td) {
        if (td.content.present) {
            if (td.content.count < 1) return ttStatusUpdate(TT.statuses.ERROR, "Couldn't handle content for Tweet " + td.tweetId);
            var dlAction = createDownloadAction();

            switch (td.content.type) {
                case "image":
                    addImageContent(td, dlAction.container);
                    break;
                case "video":
                    addVideoContent(td, dlAction.container); // Preview
                    break;
                case "gif":
                    td.content.eventElement = td.content.video.player.parentElement.parentElement;
                    $(td.content.eventElement).on("uiPlayableMediaReady", {
                        td,
                        c: dlAction.container
                    }, addGifContent); //Not using .one() cause for some reason the event is fired twice and the first doesn't indicate the dom change.
                    break;
                default:
                    return ttStatusUpdate(TT.statuses.LOG, "Couldn't find content type for tweet ID " + td.tweetId);
            }

            addDownloadAction(td.origTweet, dlAction.base);
        } else handleTextTweet(td);

        return ttStatusUpdate(TT.statuses.OK);
    }

    // Element (Tweet) -> {TweetData}
    //Parses Tweet t to give us all the data we could ever want in a custom Object.
    function parseTweet(t) {
        var td = t.dataset;
        var hasContent = td.hasCards ? true : false,
            type, cardEl;

        var images = [],
            video = {
                thumb: "",
                url: "",
                player: null
            },
            contentCount = 0;

        if (hasContent) {
            ({
                type,
                element: cardEl
            } = parseTweetType(t));

            switch (type) {
                case "image":
                    var imgContArr = cardEl.getElementsByClassName("js-adaptive-photo");
                    if (imgContArr) {
                        for (let imgCont of imgContArr) {
                            images.push(imgCont.dataset.imageUrl);
                        }
                        contentCount = images.length;
                    } else ttStatusUpdate(TT.statuses.ERROR, "Can't locate image(s) for Tweet " + td.tweetId);
                    break;

                case "gif": //Uses a simple video elem with src set.
                    video.player = cardEl;
                    //                video.thumb = video.player.poster;
                    video.type = "mp4";
                    //                video.url = video.player.src;

                    contentCount = 1;
                    break;
                case "video": //Uses a MediaSourceExt video el, created from an API request.
                    video.player = cardEl;
                    video.thumb = video.player.style.backgroundImage.match(/http[^\"]+/)[0];
                    let vData = TT.vidLibrary[td.tweetId];
                    if (vData) {
                        video.type = vData.type;
                        video.url = vData.url;
                    }

                    contentCount = 1; //Only ever one vid. Set it here cause vData could be filled later, by user dl request time.
                    break;
            }
        }


        return {
            origTweet: t,
            tweetId: td.tweetId,
            userId: td.userId,
            userHandle: td.screenName,
            userName: td.name,
            content: {
                present: hasContent,
                type: type,
                container: cardEl,
                images: images,
                video: video,
                count: contentCount
            }
        };
    }

    // Element (Tweet) -> { String, Element }
    // Returns the tweet's type and element containing said type.
    function parseTweetType(t) {
        var e = t,
            ty = "";
        let c = findClass(t, "AdaptiveMedia-container");
        if (c) {
            switch (c.firstElementChild.className) {
                case "AdaptiveMedia-quadPhoto":
                case "AdaptiveMedia-doublePhoto":
                case "AdaptiveMedia-triplePhoto":
                case "AdaptiveMedia-singlePhoto":
                    ty = "image";
                    e = c.firstElementChild;
                    break;
                case "AdaptiveMedia-video":
                    ty = findClass(c, "PlayableMedia--gif") ? "gif" : "video";
                    e = findClass(c, "PlayableMedia-player");
                    break;
            }
        }
        /*    switch (true) {
                case (e = findClass(t, "AdaptiveMedia-quadPhoto")) && true:
                case (e = findClass(t, "AdaptiveMedia-doublePhoto")) && true:
                case (e = findClass(t, "AdaptiveMedia-triplePhoto")) && true:
                case (e = findClass(t, "AdaptiveMedia-singlePhoto")) && true:
                    ty = "image";
                    break;
                case (e = findClass(t, "PlayableMedia--video")) && true:
                    ty = "video";
                    break;
                case (e = findClass(t, "PlayableMedia--gif")) && true:
                    ty = "gif";
                    break;
            }*/

        return {
            type: ty,
            element: e
        };
    }

    // Element (Tweet) -> TTStatus
    // TODO
    function handleTextTweet(t) {
        return 0;
    }

    // TweetData, Element -> TTStatus
    // Processes a Video tweet.
    function addVideoContent(td, container) {
        var item,
            preview = td.content.video.thumb;

        item = addDownloadLink(container, "#tt-null", preview);
        if (td.content.video.type == "mp4") {
            item.link.href = td.content.video.url;
        } else {
            item.link.onclick = function (e) {
                item.item.style.outline = "5px double #8e9ede";
                createVideoURL(td)
                    .then(blobUrl => {
                        item.link.href = blobUrl;
                        item.link.download = item.link.title = item.link.name = createFilename(preview, td, "name-id");
                        item.item.style.outline = "5px double #80a963";
                    })
                    .catch(e => ttStatusUpdate(TT.statuses.ERROR, e)); // item.link.click()
                e.preventDefault();
                item.link.onclick = null; //e => e.preventDefault();
            };
            //item.link.onclick = () => alert("DEBUG: Video downloads now.");
        }

        return ttStatusUpdate(TT.statuses.OK);
    }

    // TweetData, Element -> TTStatus
    // Processes a GIF tweet.
    function addGifContent({
        data: {
            td,
            c: container
        }
    }) {
        var item,
            v = td.content.video.player.getElementsByTagName("video")[0];

        if (v) {
            item = addDownloadLink(container, v.src, v.poster);
            item.link.download = item.link.title = item.link.name = createFilename(v.src, td);
            $(td.content.eventElement).off("uiPlayableMediaReady", addGifContent);
        }

        return ttStatusUpdate(TT.statuses.OK);
    }

    // TweetData, Element -> TTStatus
    // Adds image content for tweet t to container
    function addImageContent(td, container) {
        var item,
            href;

        for (let image of td.content.images) {
            href = createImageURL(image, TT.imgmodes.orig);
            item = addDownloadLink(container, href, image);
            item.link.download = item.link.title = item.link.name = createFilename(image, td);
        }

        return ttStatusUpdate(TT.statuses.OK);
    }

    // none -> Element (DownloadContainer)
    //Simple helper function to have one place to create this and set its class.
    //Now also adds the button to open it.
    function createDownloadAction() {
        var cont = createElement("div", "dropdown-menu tt-cont");
        cont.innerHTML = "<div class='dropdown-caret caret-up'> <div class='caret-outer caret-up-outer'></div> <div class='caret-inner caret-up-inner'></div> </div>";
        var action = createElement("div", "ProfileTweet-action tt-dl");
        action.innerHTML = "<button class='ProfileTweet-actionButton u-textUserColorHover js-tooltip tt-open-cont' data-original-title='Download Content'> <div class='IconContainer tt-hide-events'> <span class='Icon Icon--medium Icon-tt-dl'></span> </div></button></div>";
        var d = createElement("div", "dropdown tt-cont-align");
        d.appendChild(cont);
        action.appendChild(d);
        action.style.position = "relative";

        return {
            base: action,
            container: cont
        };
    }

    // Tweet, Element (DownloadContainer) -> TTStatus
    // Adds Element e to Tweet t. Specifically for dl links container though!
    function addDownloadAction(t, e) {
        var injPos = findClass(t, "js-actions"); //Change this to place the dl links in different places.
        if (!injPos) return ttStatusUpdate(TT.statuses.ERROR, "Can't add link container.");
        injPos.appendChild(e);

        return ttStatusUpdate(TT.statuses.OK);
    }

    // Element (TTDownloadContainer), String (URL), String (URL) -> {ElementParts} | TTStatus
    // Adds a download link with url dst to Element cont, using thumb as a preview.
    function addDownloadLink(cont, dst, thumb) {
        if (arguments.length != 3 || !(cont instanceof HTMLElement)) return ttStatusUpdate(TT.statuses.ERROR, "Incorrect arguments to construct link.");

        let item = createElement("div", "tt-item"),
            link = createElement("a", "tt-link-dl"),
            symbol = createElement("img", "tt-thumb-dl");

        symbol.src = thumb;
        link.href = dst;

        link.appendChild(symbol);
        item.appendChild(link);
        cont.appendChild(item);

        return {
            'item': item,
            'link': link,
            'symbol': symbol
        };
    }

    //Uh I rewrote this for tiny speed up but... yeah idk man.
    function toggleContainer(e) {
        if (e.button !== 0) return; //Only interested in left clicks.

        function openTargetContainer() {
            e.target.nextElementSibling.classList.add("open");
            TT.openCont = e.target;
        }

        function closeCurrentContainer() {
            TT.openCont.nextElementSibling.classList.remove("open");
            TT.openCont = null;
        }

        function clickedButton() {
            return checkClass(e.target, "tt-open-cont");
        }

        function clickedContentArea() {
            let el = e.target;
            for (let i = 0; i < 5; i++) {
                if (el) {
                    if (checkClass(el, "tt-cont")) return true;
                    el = el.parentElement;
                } else break;
            }
            return false;
        }

        if (TT.openCont) {
            if (e.target == TT.openCont) {
                closeCurrentContainer();
            } else if (clickedButton()) {
                closeCurrentContainer();
                openTargetContainer();
                return;
            } else if (!clickedContentArea()) {
                closeCurrentContainer();
            }
        } else {
            if (clickedButton()) {
                openTargetContainer();
            }
        }

    }

    // String, TTEnum.imgmode -> String
    // Transforms a url for images to point to the desired one.
    function createImageURL(url, mode) {
        var p;
        switch (mode) {
            case TT.imgmodes.base:
                p = "";
                break;
            case TT.imgmodes.thumb:
                p = ":thumb";
                break;
            case TT.imgmodes.small:
                p = ":small"; // or "" cause I think this is default
                break;
            case TT.imgmodes.large:
                p = ":large";
                break;
            case TT.imgmodes.orig:
            default:
                p = ":orig";
        }

        return url.replace(/:[^\/]*$|$/, p);
    }

    // TweetData -> Promise (BlobURL)
    // Class: PlayableMedia-player
    function createVideoURL(td) {
        if (!td.content.video.url) {
            if (!TT.vidLibrary[td.tweetId]) {
                ttStatusUpdate(TT.statuses.ERROR, `No media info available for tweet ${td.tweetId}`);
                return;
            } else {
                td.content.video.url = TT.vidLibrary[td.tweetId].url;
                td.content.video.type = TT.vidLibrary[td.tweetId].type;
                if (td.content.video.type == "mp4") { //TODO: is bugfix, should make it more ~elegant~
                    return Promise.resolve(td.content.video.url);
                }
            }
        }

        let p_fullUrl = getPlaylistData(td.content.video.url)
            .then(d => {
                if (d.type != "master") throw "Expected master playlist at " + d.from;
                if (d.streams.length < 1) throw "Found no media playlists in " + d.from;
                return getPlaylistData(d.streams.pop().url);
            })
            .then(d => {
                if (d.type != "media") throw "Expected media playlist at " + d.from;
                if (d.dataParts.length < 1) throw "Found no video parts at " + d.from;
                return fetchVideo(d.dataParts);
            });
        p_fullUrl.catch(e => ttStatusUpdate(TT.statuses.ERROR, e));

        return p_fullUrl;
    }


    // String (Playlist) -> {PlaylistData}
    // Called with "https://video.twimg.com/ext_tw_video/891982015603417088/pu/pl/PZHAmJKjJHgT-Tap.m3u8"
    //https://video.twimg.com/ext_tw_video/1014796189219241984/pu/pl/pKhGNHCxwz4G3sLP.m3u8?tag=3
    function getPlaylistData(plUrl) {
        async function getPlaylist(url) {
            let response = await fetch(url);
            if (!response.ok) throw "Failed to download playlist: " + url;
            let dataText = await response.text();

            return dataText;
        }

        function parse(playlistTextData, r) {
            var parsedData = {
                    type: '',
                    streams: [],
                    dataParts: []
                },
                lines,
                host = "https://video.twimg.com";

            lines = playlistTextData.split('\n');
            if (lines[0] !== '#EXTM3U') throw 'Playlist parser did not receive an M3U file';

            for (var p, i = 1; i < lines.length; i++) {
                p = lines[i].split(/:|=|,(?![^=,"]*")/);
                if (p[0] == '#EXT-X-STREAM-INF') {
                    parsedData.type = 'master';
                    parsedData.streams.push({
                        bitrate: parseInt(p[4]),
                        res: p[6],
                        url: host + lines[++i]
                    });
                } else if (p[0] == "#EXTINF") {
                    parsedData.type = "media";
                    parsedData.dataParts.push(host + lines[++i]);
                }
            }

            r(parsedData);
        }

        return new Promise((r, e) => getPlaylist(plUrl).then(d => parse(d, r)).catch(err => e(err)));
    }

    // {PlaylistData} -> Promise (Resolve: string (BlobURL))
    function fetchVideo(pd) {
        var doneCount = 0,
            partBlobs = [],
            lastDoneCheck = 0,
            timeoutInterval;

        function constructFullBlob(blob, r) {
            partBlobs[blob.idx] = blob.data;
            if (doneCount == pd.length) {
                clearInterval(timeoutInterval);
                let fullBlob = new Blob(partBlobs, {
                    type: "video/MP2T"
                });
                //video MIME
                let fullVideoUrl = URL.createObjectURL(fullBlob);
                r(fullVideoUrl);
            } else if (doneCount > pd.length) throw "Something went terribly wrong";
        }

        async function downloadPart(part, r) {
            //console.log("Downloading " + part);
            //Try here as await will throw is rejected.
            let response = await fetch(part.url); //fetch
            //console.log("Downloaded " + part);
            if (!response.ok) throw "Part " + part.idx + " download failed.";
            let dataBlob = await response.blob();
            doneCount++;
            r({
                idx: part.idx,
                data: dataBlob
            });
        }

        function timeoutCheck() {
            if (doneCount > lastDoneCheck) lastDoneCheck = doneCount;
            else if (doneCount == lastDoneCheck) throw "Download timed out";
        }

        //takes in an array or URLs to .ts
        return new Promise(function (r, e) {
            var partN = 0;
            for (let part of pd) {
                let p = new Promise(r2 => downloadPart({
                    idx: partN,
                    url: part
                }, r2));
                p.then(v => constructFullBlob(v, r))
                    .catch(e);
                partN++;
            }
            timeoutInterval = setInterval(timeoutCheck, 30000);
        });
    }

    //string (URL), String -> String
    function createFilename(url, td, pattern) {
        let regex = createImageURL(url, TT.imgmodes.base).match(/([^\/]+)\.([^\/]+)$/);
        let filename,
            ext;

        switch (td.content.type) {
            case "video":
            case "gif":
                ext = td.content.video.type;
                break;
                //            ext = td.content.type;
                //            break;
            default:
                ext = regex[2];
        }

        if (pattern == "name-id") {
            filename = `${td.userHandle} - ${td.tweetId}`;
        }
        //...other patterns later TODO: add customizable naming schemes
        else {
            filename = regex[1];
        }

        return `${filename}.${ext}`;
    }

    //Helper Functions

    // String, String -> Element
    // Creates an Element of type with class cname
    function createElement(type, cname) {
        var el = document.createElement(type);
        el.className = cname;
        return el;
    }

    // Element String -> Element | null
    // Returns the first Element descendant from e matched by ClassName c or null if not found.
    function findClass(e, c) {
        var list = e.getElementsByClassName(c);
        return list ? list[0] : null;
    }

    // Element String -> Bool
    // Returns true if the Element has Class c
    function checkClass(e, c) {
        return e.classList.contains(c);
    }

    // Tweet -> Element | null
    // Returns the useful video element if there is one, otherwise null. TODO

    // String... -> EnumObject
    function ttEnum() {
        var o = {},
            name;
        for (let i in arguments) {
            name = arguments[i];
            o[name] = i;
        }
        Object.freeze(o);
        return o;
    }

    // TTStatus, String -> TTStatus
    function ttStatusUpdate(status, ...msg) {
        TT.status = status;
        if (status != TT.statuses.OK) {
            let useConsole = status == TT.statuses.ERROR ? TT.console.error : TT.console.log;
            let stName = Object.keys(TT.statuses)[status];
            if (!stName) stName = "Error";
            useConsole(stName + ":", ...msg || "Unknown Error.");
        }
        return status;
    }

    function ttInjectCSS() {
        var s = document.head.appendChild(document.createElement("style"));
        //s.innerHTML = ".tt-cont { position: absolute; left: 100%; top: 0; margin-left: 0.5rem; height: 100px; width: 100px; line-height: 0; box-sizing: border-box; display: flex; flex-wrap: wrap; align-content: flex-start; } .tt-item { height: calc(50% - 0.2rem); width: calc(50% - 0.2rem); background-color: rgba(230, 236, 240, 0.4); border-radius: 2px; margin: 0.1rem; line-height: 0; overflow: hidden; box-sizing: border-box; display: flex; align-items: center; } .tt-link-dl { display: flex; justify-content: center; align-items: center; } .tt-thumb-dl { max-height: 120%; max-width: 120%; flex: 0 0 auto; z-index: -1; } /*Adjusting Twitter a bit. WorksOnMyMachine™*/ .Grid-cell.u-size1of3:last-child { margin-left: 110px; position: absolute; max-width: 25%; }";
        s.innerHTML = ".dropdown-caret.caret-up { bottom: -10px; top: auto; left: calc(50% - 9px); } .caret-outer.caret-up-outer { border-top: 10px solid rgba(0,0,0,0.1); border-bottom: 0; border-top-color: rgba(0,0,0,0.1); } .caret-inner.caret-up-inner { border-top: 9px solid #fff; border-bottom: 0; top: 0; /* left: 0; */ } .tt-cont-align { position: absolute; width: 300px; bottom: calc(100% + 10px); left: calc(-150px + 25%); text-align: center; } .Icon-tt-dl:before { content: '\\2913'; } .Icon--medium.Icon-tt-dl { padding-bottom: 2px; } .ProfileTweet-actionButton.tt-open-cont { line-height: 0; width: 100%; text-align: left; } .ProfileTweet-actionButton.tt-open-cont:focus { color: hotpink !important; box-shadow: none; } .dropdown.open .tt-cont { margin: 0.1rem; display: inline-flex; justify-content: center; position: relative; float: none; padding: 0.4rem; background-color: white; border: 1px solid rgba(0,0,0,0.1); } .tt-item { height: 50px; width: 50px; border-radius: 2px; margin: 0.3rem; overflow: hidden; display: flex; align-items: center; } .tt-link-dl { display: flex; justify-content: center; align-items: center;; } .tt-thumb-dl { max-height: 125%; max-width: 125%; flex: 0 0 auto; } .tt-hide-events { pointer-events: none; }";

    }

    // none -> Bool
    function ttOK() {
        return TT.status == TT.statuses.OK;
    }
    //`;
}

//Debug function, might be useful later.
function getTweetByID(id) {
    return document.querySelector("[data-tweet-id='" + id + "']");
}

window.setTimeout("(" + twitterTools.toString() + ")()", 0);
