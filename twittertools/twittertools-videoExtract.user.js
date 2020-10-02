// ==UserScript==
// @name        HLS stream downloader
// @description Allows downloading of video streams in m3u8/ts format. Extracted from my old twitter script, may not work everywhere.
// @version     0.1
// @author      noccu
// @namespace   nc_downloaders
// @match       *://*/*
// @grant       GM_registerMenuCommand
// ==/UserScript==

'use strict';

function download() {
    var a = document.createElement("a");
    a.id = "hlsd"; //for debugging
    a.style.display = "none";
    document.body.appendChild(a);

    let url = prompt("Playlist URL", "https://host.tld/link/to/video.m3u8");
    if (url && url.startsWith("http")) {
        createVideoURL(url)
        .then(vid => {
            console.log(vid);
            a.href = vid;
            a.download = (prompt("Name") || url.split(/\/|\./).slice(-2,-1)[0]) + ".m2ts";
            a.click();
        })
    }
    else { alert("Invalid input") }
}
// Url -> Promise (BlobURL)
// Coordinates playlist parsing, returns a blob url to full video data
function createVideoURL(inputUrl) {
    let p_fullUrl = getPlaylistData(inputUrl)
        .then(d => {
            if (d.type == "master") {
                if (d.streams.length < 1) throw "Found no media playlists in " + d.from;
                return getPlaylistData(d.streams.pop().url);
            }
            else { return d } // passthrough
        })
        .then(d => {
            if (d.type == "media") {
                if (d.dataParts.length < 1) throw "Found no video parts at " + d.from;
                return fetchVideo(d.dataParts);
            }
            else throw "Expected media playlist at " + d.from;
        });
    p_fullUrl.catch(e => alert(e));
    return p_fullUrl;
}
// Parses playlists for stream links
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
            }
            else if (p[0] == "#EXTINF") {
                parsedData.type = "media";
                parsedData.dataParts.push(host + lines[++i]);
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
        //console.log("Downloading " + part);
        //Try here as await will throw is rejected.
        let response = await fetch(part.url); //fetch
        //console.log("Downloaded " + part);
        if (!response.ok) throw "Part "+part.idx+" download failed.";
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
            let p = new Promise(r2 => downloadPart({idx: partN, url: part}, r2));
            p.then(v => constructFullBlob(v, r))
             .catch(e);
            partN++;
        }
        timeoutInterval = setInterval(timeoutCheck, 30000);
    });
}
GM_registerMenuCommand("HLS Download", download);