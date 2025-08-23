// ==UserScript==
// @name        Youtube thumb links
// @namespace   yt_fuckery
// @match       https://www.youtube.com/*
// @grant       none
// @version     1.1
// @author      noccu
// @description Add thumbnail link to videos. Check the … menu.
// ==/UserScript==

function getThumb(el) {
    thumbEl = el.querySelector("img.ytCoreImageHost")
    return thumbEl.src.split("?")[0].replace("hqdefault", "hq720")
}

const THUMB_BUTTON = document.createElement("yt-list-item-view-model")
const THUMB_LINK = document.createElement("a")
THUMB_LINK.textContent = "Thumbnail"
THUMB_BUTTON.style.color = "inherit"
THUMB_BUTTON.className = "yt-list-item-view-model-wiz yt-list-item-view-model-wiz__container"
THUMB_LINK.className = "yt-list-item-view-model-wiz__title"
THUMB_BUTTON.append(THUMB_LINK)
var BUTTON_ADDED = false

function addButton() {
    if (BUTTON_ADDED) return
    document.querySelector("yt-download-list-item-view-model").before(THUMB_BUTTON)
    BUTTON_ADDED = true
}

function updateThumbUrl(e) {
    if (e.target.tagName != "DIV" || !e.target.className.endsWith("fill")) {
        return
    }
    const videoRoot = e.target.closest("div.yt-lockup-view-model-wiz")
    if (videoRoot) {
        addButton()
        THUMB_LINK.href = getThumb(videoRoot)
    }
}

document.body.addEventListener("click", updateThumbUrl)
