// ==UserScript==
// @name        Youtube thumb links
// @namespace   yt_fuckery
// @match       https://www.youtube.com/*
// @grant       none
// @version     1.0
// @author      noccu
// @description Add thumbnail link to videos. Check the … menu.
// ==/UserScript==

function getThumb(el) {
    // videoRoot = el.closest("ytd-rich-item-renderer") || el.closest("ytd-grid-video-renderer")
    videoRoot = el.closest("#dismissible")
    thumbEl = videoRoot.querySelector("img.yt-core-image")
    return thumbEl.src.split("?")[0].replace("hqdefault", "hq720")
}

const THUMB_BUTTON = document.createElement("tp-yt-paper-item")
const THUMB_LINK = document.createElement("a")
THUMB_LINK.textContent = "Thumbnail"
THUMB_BUTTON.style.minHeight = "2em"
THUMB_BUTTON.append(THUMB_LINK)
var BUTTON_ADDED = false

function addButton() {
    if (BUTTON_ADDED) return
    document.querySelector("ytd-menu-service-item-renderer[has-separator]").before(THUMB_BUTTON)
    BUTTON_ADDED = true
}

function updateThumbUrl(e) {
    if (e.target.tagName != "DIV") return
    let target = e.target.parentElement?.parentElement
    if (!target) return
    if (target.tagName == "YT-ICON" && target.classList.contains("ytd-menu-renderer")) {
        addButton()
        THUMB_LINK.href = getThumb(e.target)
    }
}

document.body.addEventListener("click", updateThumbUrl)
