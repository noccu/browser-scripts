// ==UserScript==
// @name        Fediverse@Home
// @namespace   https://github.com/noccu
// @match       *://*/*
// @grant       GM_registerMenuCommand
// @grant       GM_setValue
// @grant       GM_getValue
// @version     1.0
// @author      noccu
// @description Open Fediverse remotes on your local instance. Currently supports Misskey & Mastodon.
// ==/UserScript==

t = setInterval(check, 200)
setTimeout(() => clearInterval(t), 25000)
var HOME

function check() {
    // Are we on a fedi instance? (Dumb ver.)
    try { misskey_app }
    catch {
        try { mastodon }
        catch { return }
    }

    // We are
    clearInterval(t)
    HOME = GM_getValue("fediHome")
    if (HOME && HOME == location.origin) {
        return
    }
    GM_registerMenuCommand("Set as home instance", setHome)
    if (location.pathname.startsWith("/@")) {
        GM_registerMenuCommand("Open on home instance", takeHome)
    }
}

function setHome() {
    if (HOME) {
        newHome = confirm(`Replace ${HOME} as home instance?`)
    }
    if (!newHome) { return }
    GM_setValue("fediHome", location.origin)
    console.log(`Home instance set to: ${location.origin}`)
}

function takeHome() {
    if (!HOME) {
        alert("No home instance set yet")
        return
    }
    user = location.pathname.substring(1)
    window.location = `${HOME}/${user}@${location.host}`
}
