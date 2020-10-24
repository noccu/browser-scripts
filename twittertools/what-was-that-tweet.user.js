// @ts-check
// ==UserScript==
// @name        What was that tweet!?
// @namespace   https://github.com/noccu
// @match       https://twitter.com/home
// @grant       GM_addStyle
// @grant       GM_registerMenuCommand
// @version     1.0
// @author      noccu
// @description Keeps a list of removed tweets on your timeline.
// ==/UserScript==

"use strict";
/** @type {Element} */
var TIMELINE;
const LIST = {
    list: new Map(),
    /** @type {HTMLElement} */
    listDom: undefined,
    frag: document.createDocumentFragment(),
    maxSize: 150,
    create() {
        if (!this.listDom) {
            let closeBtn = document.createElement("div");
            closeBtn.id = "wt-close";
            closeBtn.textContent = "X";
            closeBtn.addEventListener("click", () => this.hide());
            let list = document.createElement("div");
            list.id = "wt-list";
            list.style.visibility = "hidden";
            list.append(closeBtn);
            this.listDom = list;
            document.body.append(list);
        }
    },
    add(tweet) {
        let id = tweet.getElementsByClassName("js-action-profile")[0]?.dataset.tweetId;
        if (id && !this.list.has(id)) {
            this.frag.prepend(tweet);
            this.list.set(id, tweet);
        }
    },
    remove(amount) {
        let i = 1;
        for (let [id, t] of this.list) {
            t.remove();
            this.list.delete(id);
            i++;
            if (i > amount) return;
        }
    },
    update() {
        let v;
        if (this.list.size > this.maxSize) {
            v = this.listDom.style.visibility || "visible";
            this.hide();
            this.remove(this.list.size - this.maxSize);
        }
        this.listDom.prepend(this.frag);
        if (v) this.listDom.style.visibility = v;
    },
    show() {
        this.listDom.style.visibility = "visible";
    },
    hide() {
        this.listDom.style.visibility = "hidden";
    }
}

/**
 * @param {MutationRecord[]} records
 */
function handleChange(records) {
    for (let record of records) {
        record.removedNodes.forEach( /** @arg {HTMLElement} node */ node => {
            let images = node.getElementsByTagName("img");
            if (images.length > 1 && Array.prototype.some.call(images, i => i.alt == "Image")) {
                LIST.add(node);
            }
        })
    }
    LIST.update();
}

function addCSS() {
    // @ts-ignore
    GM_addStyle(`
        #wt-list {
            position: fixed;
            top: 0;
            background-color: inherit;
            width: 500px;
            height: 100%;
            overflow: auto;
        }
        #wt-list > * {
            transform: none !important;
            position: static !important;
            opacity: 1 !important;
        }
        #wt-list .r-3s2u2q:hover {
            text-decoration: underline;
        }     
        #wt-close {
            color: black;
            position: fixed !important;
            top: 0;
            background-color: red;
            font-size: x-large;
            cursor: pointer;
        }
    `);
}

function observe() {
    var o = new MutationObserver(handleChange);
    o.observe(TIMELINE, {
        childList: true
    });
}

/**
 * @param {string} selector
 * @returns {Promise<Element>}
 */
function waitOnDOM(selector) {
    return new Promise(r => {
        function check(unused, o) {
            let target = document.querySelector(selector);
            if (target) {
                if (o && o instanceof MutationObserver) o.disconnect();
                r(target);
                return true;
            } else return false;
        }
        if (!check()) {
            let o = new MutationObserver(check);
            o.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    })
}


// Main
LIST.create();
waitOnDOM("section > div.css-1dbjc4n[aria-label$='Home Timeline'] > div:not([class])")
    .then(tl => {
        TIMELINE = tl
        addCSS();
        observe();
    });
// @ts-ignore
GM_registerMenuCommand("Show removed tweets", LIST.show.bind(LIST))