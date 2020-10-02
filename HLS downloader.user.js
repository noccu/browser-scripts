// ==UserScript==
// @name HLS Downloader
// @namespace Violentmonkey Scripts
// @include *
// @grant none
// ==/UserScript==


var dlBtn = document.createElement("a")
let inj = document.querySelector("#video-actions")

dlBtn.className = ("btn btn-default");
dlBtn.textContent = "HLS Down";
dlBtn.onclick = function() {
    let p = prompt("HLS Playlist");
    if (p !== null) {
        createVideoURL(p);
    }
}

inj.appendChild(dlBtn);


//core functions
function createVideoURL (url) {
    let p_fullUrl = getPlaylistData(url)
    .then( d => { if (d.type == "master" && d.streams.length > 0) {
                    return getPlaylistData(d.streams.pop().url).then(d2 => fetchVideo(d2.dataParts));
                  }
                  else if (d.type == "media" && d.dataParts.length > 0) {
                    return fetchVideo(d.dataParts);  
                  }
                  else {
                      console.error("No usable playlist data found.");
                  }
                });
    p_fullUrl.catch( e => console.error(e) );

    return p_fullUrl.then(u => {
        console.log(u);
        let a = document.createElement("a");
        a.href = u;
        a.download = document.title + ".ts";
        a.style.display = "hidden";
        document.body.appendChild(a);
        a.click();
    });
}

// String (Playlist) -> {PlaylistData}
// Called with "host/path/file.m3u8[?optional&stuff]"
function getPlaylistData(plUrl) {
    async function getPlaylist(url) {
        let response = await fetch(url);
        if (!response.ok) throw "Failed to download playlist: " + url;
        let dataText = await response.text();

        return dataText;
    }

    function parse(playlistTextData, r) {
        var parsedData = {type: '',
                          streams: [],
                          dataParts: []
                         },
            lines,
            host = plUrl.match(/^(https?:\/\/.+\/(?=.+\??))/)[1];

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
        dlBtn.textContent = doneCount + "/" + pd.length;
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
        console.log("Downloading part " + part.idx);
        //Try here as await will throw is rejected.
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
        timeoutInterval = setInterval(timeoutCheck, 100000);
    });
}