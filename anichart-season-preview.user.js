// ==UserScript==
// @name        AniChart Season Preview
// @namespace   https://github.com/noccu
// @match       https://anichart.net/*
// @grant       GM_addStyle
// @version     1.0
// @author      noccu
// @description Auto-expands descriptions + slightly larger font, x2 speed trailers.
// ==/UserScript==

// Improve display
GM_addStyle(`
  div.chart-view {
    margin: 0 !important;
  }
  div.card-list {
    grid-column-gap: 1em !important;
    grid-row-gap: 1em !important;
    grid-template-rows: unset !important;
    grid-template-columns: repeat(auto-fill, minmax(31em, 1fr)) !important;
    margin: 1em;
    width: unset !important;
  }
  .media-card {
    height: auto !important;
  }
  .description-wrap {
    font-size: 1.25rem !important;
  }`)

// Logic
const fEvent = new MouseEvent("mouseover")
const OBSERVER_SHOWS = new MutationObserver(cope);
const OBSERVER_TRAILER = new MutationObserver(cope);
const noop = function() {}

function expand() {
    let cards = document.querySelectorAll(".media-card")
    for (let c of cards) {
        if (c.__vue__.mouseleave == noop) { continue }
        c.__vue__.mouseleave = noop
        c.dispatchEvent(fEvent)
        // Hack in YT's js api
        try {
            c.__vue__.media.trailer.id += "?enablejsapi=1&autoplay=1&autohide=1"
        }
        catch {
            // noop
        }
    }
}

function cope(records) {
    for (let r of records) {
        for (let n of r.addedNodes) {
            if (n.nodeType != Node.ELEMENT_NODE) continue
            if (n.classList.contains("media-card")) {
                expand()
                return
            }
            else if (n.classList.contains("trailer-wrap")) {
                domExist("iframe.video", 100, 5).then(v => {
                    // v.id = "yt-trailer"
                    v.onload = () => {
                        // let listen = JSON.stringify({event: 'listening', id: v.id})
                        // v.contentWindow.postMessage(listen, "*")
                        let speed = JSON.stringify({event: 'command', func: 'setPlaybackRate', args:[2, true]})
                        v.contentWindow.postMessage(speed, "*")
                    }
                })
                return
            }
        }
    }
}


// Util
function pause (ms) {
  return new Promise(r => setTimeout(r, ms));
}
// interval in ms, timeout in s
async function domExist(selector, interval, timeout) {
  console.log("checking... ", selector);
  timeout = timeout * (1000 / interval);
  let run = 0;
  while (true && run < timeout) {
    run++;
    let domObj = document.querySelector(selector);
    if (domObj) {
      return domObj;
    }
    await pause(interval);
  }
  throw new Error("Dom search failed");
}

domExist(".card-list", 500, 15)
    .then(e => {
        expand()
        OBSERVER_SHOWS.observe(e, {childList: true, subtree: false});
        OBSERVER_TRAILER.observe(document.getElementById("app"), {childList: true, subtree: false});
    });

// window.addEventListener('message', function (msgEvt) {
//     console.log(msgEvt);
// });