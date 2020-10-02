/*jshint strict: global*/
/*globals pixiv, globalInitData*/
// ==UserScript==
// @name        Pixiv Fullsize Images
// @namespace   pixiv_fuckery
// @description Adds links to original images to various places on Pixiv.
// @match       *://*.pixiv.net/*
// @match       *://*.pximg.net/*
// @version     2.1
// @run-at       document-idle
// @noframes
// @grant       none
// ==/UserScript==

'use strict';

(function init() {
    if (window.pixiv) { //old, still used on manga and "detail" pages?
        if (pixiv.context.queries.mode == "manga") {
            addFullsizeMangaPages();
        }
        else if (location.pathname == "/history.php" && !pixiv.user.premium) {
            processHistory();
        }
    }

    else if (window.globalInitData) { //newish, used on single images and "root" pages?
        if (globalInitData.preload.illust) {
            awaitContainerLoad()
                .then(addFullsizeImage);
        }
    }

    else if (location.search.includes("mode=manga_big")) {
        addMangaIndexLink();
    }
    
    else if (location.host.includes("pximg.net")) {
        addIllustLink();
    } 
})();

function awaitContainerLoad() {
    return new Promise(function (r, x) {
        let int, to;
        function clearTimers() {
                clearTimeout(to);
                clearInterval(int);
        }
        function getContainer() {
            let container = document.querySelector("div.sticky section") || document.querySelector("div[style^=transform] section");
            if (container) {
                clearTimers();
                r(container);
            }
        }
        int = setInterval(getContainer, 300);
        to = setTimeout(function() {
            clearTimers();
            x("Container load timeout.");
        }, 10000);
    });
}

function addIllustLink() {
    let m = location.pathname.match(/(\d+)_[pm](\d+)?/);
    let id = m[1],
        page = m[2],
        mode = page > 0 ? "manga" : "medium";
    
    let a = document.createElement("a");
    a.href = `http://www.pixiv.net/member_illust.php?mode=${mode}&illust_id=${id}&page=${page}`;

    var img = document.body.getElementsByTagName("img")[0];

    document.body.appendChild(a);
    a.appendChild(img);
}

function addFullsizeMangaPages () {
    //Add direct links (shaky atm)
    let elems = document.querySelectorAll(".full-size-container");
    for (let i = 0; i < elems.length; i++)
    {
        var parts = pixiv.context.images[i].match(/(.*\.net\/).*img-master(.*)_master1200(.*)/);
        let a = document.createElement("a");
        a.href = parts[1]+"img-original"+parts[2]+".jpg";
        a.textContent = "Fullsize JPG ";
        let a2 = document.createElement("a");
        a2.href = parts[1]+"img-original"+parts[2]+".png";
        a2.textContent = "Fullsize PNG";
        elems[i].parentElement.insertBefore(a, elems[i]);
        elems[i].parentElement.insertBefore(a2, elems[i]);
    }

    //Make the location bar always display
    let bar = document.querySelector("footer ul.breadcrumbs");
    if (bar)
    {
        bar.style.position = "fixed";
        bar.style.top = "1rem";
    }

    //Scroll to the right image if specified (still doesn't work, isn't even useful tbh)
    if (pixiv.context.queries.page) {
        elems[parseInt(pixiv.context.queries.page)].scrollIntoView();
    }

    return;
}

function addFullsizeImage(cont) {
    let illust = Object.values(globalInitData.preload.illust)[0];
    if (illust) {
        let a = document.createElement("a");
        a.href = illust.urls.original;
        a.textContent = "Fullsize";
        a.style = "align-self: center; margin-right: 1em;";
        cont.appendChild(a);
    }
    let ankPanel = document.getElementById("ank-pixiv-large-viewer-button-panel");
    if (ankPanel) {
        var pageSelect = document.getElementById("ank-pixiv-large-viewer-page-selector");
        let a = document.createElement("a");
        a.href = location.href.replace("medium", "manga_big") + "&page=" + pageSelect.selectedIndex;
        a.textContent = "Manga page link";
        ankPanel.appendChild(a);
    }
}

function addMangaIndexLink() {
    let a = document.createElement("a");
    a.href = location.href.replace("mode=manga_big", "mode=manga");

    var img = document.body.getElementsByTagName("img")[0];
    img.removeAttribute("onclick");

    document.body.appendChild(a);
    a.appendChild(img);
}

function processHistory () { //For lack of premium
    function processHistoryItem (span) {
        let illustId;
        try {
            illustId = span.style.backgroundImage.match(/(\d+)_[pm]/)[1];
        }
        catch (e) {
            console.error("Couldn't find IllustId.");
            return;
        }
        var a = document.createElement("a");
        a.href = `http://www.pixiv.net/member_illust.php?mode=medium&illust_id=${illustId}`;
        span.parentElement.replaceChild(a, span);
        a.appendChild(span);
        span.classList.remove("trial");
    }

    var button = document.querySelector("h1 span.trial");
    if (button) {
        var a = document.createElement("a");
        a.style.cursor = "pointer";
        a.onclick = function (){
            var thumbs = document.querySelectorAll("._history-item.trial");
            for (let thumb of thumbs) {
                processHistoryItem(thumb);
            }
        };
        button.parentElement.replaceChild(a, button);
        button.textContent = "Untrial";
        a.appendChild(button);
    }
}