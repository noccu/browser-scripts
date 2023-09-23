// ==UserScript==
// @name        HLS stream downloader
// @description Allows downloading of video streams in m3u8/ts format. Extracted from my old twitter script, may not work everywhere.
// @version     0.2
// @author      noccu
// @namespace   https://github.com/noccu
// @match       *://*/*
// @grant       GM_registerMenuCommand
// @run-at      document-start
// ==/UserScript==

'use strict';
GM_registerMenuCommand("HLS Download", download);
GM_registerMenuCommand("HLS List", showList);

//Settings
const useDocTitle = false;
const list = [];
var listShown;

function download(url) {
    var a = document.createElement("a");
    a.id = "hlsd"; //for debugging
    if (!url) {
        url = prompt("Playlist URL", "url/to/playlist.m3u8");
    }

    if (url && url.startsWith("http")) {
        createVideoURL(url)
        .then(vid => {
            // console.log(vid);
            a.href = vid;
            a.download = (prompt("Name") || useDocTitle ? document.title : url.split(/\/|\./).slice(-2,-1)[0]) + ".ts";
            a.click();
        })
    }
    else { alert("Invalid input") }
}

function showList() {
    if (listShown) {
        listShown.cont.style.display = "flex";
        return;
    }
    else {
        if (list.length == 0) return;
        let cont = document.createElement("div");
        cont.style = "position: fixed;display: flex;width: 100%;top: 20%;justify-content: center;z-index: 999;"
        let ul = document.createElement("ul");
        ul.style = "background-color: black;list-style: none;padding: 1em;color:white !important;";
        cont.appendChild(ul);
        cont.addEventListener("click", e => {
            if (e.target.url) download(e.target.url);
            if (!e.shiftKey) {
                cont.style.display = "none";
            }
        });
        document.body.appendChild(cont);
        listShown = {cont, ul};
    }

    list.forEach(e => {
        let li = document.createElement("li");
        li.textContent = e.url; //`Download ${e.page}`;
        li.style.cursor = "pointer";
        li.url = e.url;
        listShown.ul.appendChild(li);
    })
}

XMLHttpRequest.prototype.realSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(value) {
    this.addEventListener("load", function ic () {
        if (/\.m3u8(?:\?|$)/.test(this.responseURL)) {
            list.push({page: document.title, url: this.responseURL});
        }
    }, {passive: true, once: true});
    this.realSend(value);
};

// Url -> Promise (BlobURL)
// Coordinates playlist parsing, returns a blob url to full video data
function createVideoURL(inputUrl) {
    let p_fullUrl = getPlaylistData(inputUrl)
        .then(d => {
            if (d.type == "master") {
                if (d.streams.length < 1) throw "Found no media playlists in " + d.from;
                console.log("Found master playlist, fetching streams...");
                return getPlaylistData(d.streams.pop().url);
            }
            else { return d } // passthrough
        })
        .then(d => {
            if (d.type == "media") {
                if (d.dataParts.length < 1) throw "Found no video parts at " + d.from;
                console.log("Found stream, fetching parts...");
                return fetchVideo(d.dataParts);
            }
            else throw "Expected media playlist at " + d.from;
        });
    p_fullUrl.catch(e => alert(e));
    return p_fullUrl;
}

// String (Playlist) -> {PlaylistData}
// Parses playlists for stream links
// Called with "origin/path/file.m3u8[?optional&stuff]"
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
            host = (new URL(plUrl)).origin;

        lines = playlistTextData.split('\n');
        if (lines[0] !== '#EXTM3U') throw 'Playlist parser did not receive an M3U file';

        for (let p, i = 1; i < lines.length; i++) {
            p = lines[i].split(/:|=|,(?![^=,"]*")/);
            if (p[0] == '#EXT-X-STREAM-INF') {
                let nextLine = lines[++i];
                parsedData.type = 'master';
                parsedData.streams.push({
                    bitrate: parseInt(p[4]),
                    res: p[6],
                    url: nextLine.startsWith("http") ? nextLine : host + nextLine
                });
            }
            else if (p[0] == "#EXTINF") {
                let nextLine = lines[++i];
                parsedData.type = "media";
                parsedData.dataParts.push(nextLine.startsWith("http") ? nextLine : host + nextLine);
            }
        }

        r(parsedData);
    }

    return new Promise( (r,e) =>  getPlaylist(plUrl).then( d => parse(d, r) ).catch(err => e(err)) );
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
            let fullBlob = new Blob(partBlobs,{type: "video/MP2T"});
            //video MIME TODO: change based on actual type!
            let fullVideoUrl = URL.createObjectURL(fullBlob);
            r(fullVideoUrl);
        }
        else if (doneCount > pd.length) throw "Something went terribly wrong";
    }

    async function downloadPart(part, r) {
        //console.log("Downloading part " + part.idx);
        //TODO: Error handling as fetch will throw if rejected.
        let response = await fetch(part.url); //fetch
        console.log("Downloaded part " + part.idx);
        if (!response.ok) {
            console.error(part.url + " failed with " + response);
            throw "Part "+part.idx+" download failed.";
        }
        let dataBlob = await response.blob();
        doneCount++;
        r({idx: part.idx, data: dataBlob});
    }

    function timeoutCheck () {
        if (doneCount > lastDoneCheck) lastDoneCheck = doneCount;
        else if (doneCount == lastDoneCheck) throw "Download timed out";
    }

    //takes in an array or URLs to .ts
    return new Promise(function (r, e) {
        var partN = 0;
        for (let part of pd) {
            let p = new Promise(resolvePart => downloadPart({idx: partN, url: part}, resolvePart));
            p.then(v => constructFullBlob(v, r))
             .catch(e);
            partN++;
        }
        console.log("Last part: " + partN);
        timeoutInterval = setInterval(timeoutCheck, 100000);
    });
}
