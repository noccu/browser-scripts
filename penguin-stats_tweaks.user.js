// ==UserScript==
// @name        Penguin-stats tweaks
// @namespace   Violentmonkey Scripts
// @match       https://penguin-stats.io/*
// @grant       none
// @version     1.1
// @author      noccu
// @description Tweaks for penguin stats.
// ==/UserScript==

const CHECK_INTERVAL = 300;
const TIMEOUT = 3 * (1000 / CHECK_INTERVAL); //Number of seconds before giving up.

function timeout (ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function showAll() {
  let run = 0;
  while (true && run < TIMEOUT) {
    run++;
    await timeout(CHECK_INTERVAL);
    let id = document.querySelector("div[aria-owns*=list]");
    if (id) {
      id.click();
      let opt = document.querySelector(`#${id.getAttribute("aria-owns")} > div:last-child`)
        if (opt) {
          console.log("clicking opt");
          opt.click();
          continue;
        }
    }
    let sort = document.querySelector(".v-data-table-header th[aria-label*='Sanity Required']");
    if (sort && sort.getAttribute("aria-sort") != "ascending") {
      sort.click();
    }
  }
}

window.addEventListener("popstate", showAll);
showAll();

var opush = history.pushState;
window.history.pushState = new Proxy(opush, {
  apply: function (t, c, a) {
    showAll();
    return Reflect.apply(t, c, a);
  }
});
