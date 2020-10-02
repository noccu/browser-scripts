// ==UserScript==
// @name         SearchFinder
// @namespace    https://github.com/noccu
// @version      1
// @description  Adds ctrl+shift+f keybind for activating search bars to all sites.
// @author       noccu
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    window.addEventListener("keydown", e => {
        if ((e.key == "F" || e.key == "f") && e.ctrlKey && e.shiftKey) {
            let s = document.querySelector("input[type=search], input[type=text][class*=search], input[type=text][id*=search]");
            if (s) s.focus();
        }
    });
})();