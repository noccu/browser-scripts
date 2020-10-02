// ==UserScript==
// @name        Clear all DA notifs
// @namespace   https://github.com/noccu
// @match       https://www.deviantart.com/notifications/*
// @grant       none
// @version     1.0
// @author      noccu
// @description Adds a button to clear all your notifs on DeviantArt.
// ==/UserScript==

(function () {
  'use strict';
  
  function removeAll() {
    let buttons = header.parentElement.querySelectorAll("button[aria-label=Remove]");
    buttons.forEach(btn => btn.click());
    buttons = document.querySelectorAll("button._2Ew0Y");
    buttons.forEach(btn => btn.click());
  }
  
  var header = document.getElementsByClassName("_2k8aX");
  header = Array.prototype.find.call(header, h => h.firstElementChild.textContent == "Activity");
  let clear = document.createElement("span");
  clear.textContent = "Clear all";
  clear.style = "margin-right:1em;cursor: pointer;";
  clear.onclick = removeAll;
  header.children[0].insertAdjacentElement("afterend", clear);
})();