// ==UserScript==
// @name        Youtube thumb links
// @namespace   yt_fuckery
// @match       https://www.youtube.com/*
// @grant       none
// @version     1.2.1
// @author      noccu
// @description Add thumbnail link to videos. Check the … menu.
// ==/UserScript==

const [PREVIEW_BUTTON, PREVIEW_LINK] = createPreviewLink()
var PREVIEW_ADDED = false


function getPreviewThumbUrl(el) {
    thumbEl = el.querySelector("img.ytCoreImageHost")
    return thumbEl.src.split("?")[0].replace("hqdefault", "hq720")
}

// Small thumbnails in a list/feed.
function createPreviewLink() {
    const btn = document.createElement("yt-list-item-view-model")
    btn.style.color = "inherit"
    btn.className = "yt-list-item-view-model yt-list-item-view-model__container"
    const link = document.createElement("a")
    link.textContent = "Thumbnail"
    link.className = "yt-list-item-view-model__title"
    btn.append(link)
    return [btn, link]
}

function addPreviewBtn() {
    if (PREVIEW_ADDED) return
    document.querySelector("yt-download-list-item-view-model").before(PREVIEW_BUTTON)
    PREVIEW_ADDED = true
}

// Try to add a thumb link to feed menus.
function updatePreviewUrl(e) {
    const videoRoot = e.target.closest("div.yt-lockup-view-model")
    if (videoRoot) {
        addPreviewBtn()
        PREVIEW_LINK.href = getPreviewThumbUrl(videoRoot)
    }
}

function tryAddButtons(e) {
    if (e.target.tagName != "DIV" || !e.target.className.endsWith("fill")) {
        return
    }
    updatePreviewUrl(e)
}
document.body.addEventListener("click", tryAddButtons)
