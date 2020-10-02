// ==UserScript==
// @name        DMM Region Bypass
// @namespace   dmm_fuckery
// @match       *://*.dmm.com/*
// @version     1
// @run-at      document-start
// @grant       none
// ==/UserScript==

document.cookie="ckcy=1";

if (location.pathname.contains("/login/"))
{
    window.addEventListener("beforescriptexecute", function(e) {
        if (e.target == document.getElementById("main-my").getElementsByTagName("script")[0])
        {
            e.preventDefault();
        }
    });
}
