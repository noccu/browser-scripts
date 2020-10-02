// ==UserScript==
// @name         Unpack links
// @namespace    https://github.com/noccu
// @version      0.1
// @description  Replaces tracking redirects with link to the actual content where easily available.
// @author       noccu
// @include      *
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let a = document.querySelectorAll("a");
    for (let link of a) {
        if (link.href.match(/[=\/](https?.+)[&?]/)) {
            link.href = decodeURIComponent(RegExp.$1);
        }
    }
})();