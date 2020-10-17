// ==UserScript==
// @name         Pixiv Extra Stats
// @namespace    https://github.com/noccu
// @match        https://www.pixiv.net/*
// @grant        none
// @version      1.1.1
// @description  Add extra stats to the Pixiv dashboard (old and new).
// @author       noccu
// ==/UserScript==

(function () {
    'use strict';
    
    if (location.pathname.startsWith("/manage")) oldPixiv();
    else newPixiv();
    
    function newPixiv() {
        injectCSS();
        const re_newPixiv = new RegExp("(ajax/dashboard/home)|(ajax/dashboard/works/)");
        if (location.pathname.endsWith("works")) { worksPage(); }
        else if (location.pathname.endsWith("board")) { homePage(); }
        peekFetch();
        
        //Functions 
        function homePage() {
            function addStats(work, stats) {
                if (!stats) { return }
                var cont = document.createElement("div");
                cont.innerHTML = `Like rate: <span class="exStats">${stats.likeRate}</span>% | Bookmark rate: <span class="exStats">${stats.bookmarkRate}</span>% | Daily views: <span class="exStats">${stats.avgViewsPerDay}</span>`;
                cont.style.fontSize = "0.8rem";
                cont.style.textAlign = "center";
                work.appendChild(cont);
            }

            function getStats(work) {
                let views = work.getElementsByClassName("gtm-dashboard-home-latest-works-number-link-view"),
                likes = work.getElementsByClassName("gtm-dashboard-home-latest-works-number-link-like"),
                bookmarks = work.getElementsByClassName("gtm-dashboard-home-latest-works-number-link-bookmark"),
                date = work.getElementsByClassName("h8luo8-9");
                
                //assume it's all fine
                if (views.length) {
                    views = getNumber(views[0].getElementsByClassName("zpz4nj-2")[0].textContent);
                    likes = getNumber(likes[0].getElementsByClassName("zpz4nj-2")[0].textContent);
                    bookmarks = getNumber(bookmarks[0].getElementsByClassName("zpz4nj-2")[0].textContent);
                    date = new Date(date[0].textContent);
                }
                else {
                    console.error("Invalid data");
                    return;
                }
                
                return {
                    likeRate: (likes / views * 100).toFixed(2),
                    bookmarkRate: (bookmarks / views * 100).toFixed(2),
                    avgViewsPerDay: (views / Math.ceil((Date.now() - date) / 86400000)).toFixed(0)
                }
            }

            waitOn("ul > div.h8luo8-0", e => {
                e.children.forEach(w => addStats(w, getStats(w)));
            });
        }     
        //Works page
        function worksPage() {
            var indexCache;
            //This assumes querySelectorAll returns in order every time... big thonk.
            function indexColumns () {
                if (indexCache) return indexCache;
                let idx = {}, dom = document.querySelectorAll(".sc-1b2i4p6-22");
                dom.forEach((e, i) => {
                    switch (e.firstElementChild.firstElementChild.textContent) {
                        case "Likes":
                            idx.likes = i; break;
                        case "Bookmarks":
                            idx.bookmarks = i; break;
                        case "Views":
                            idx.views = i; break;
                        case "Date":
                            idx.date = i; break;
                    }
                });
                //Prevent needless processing when observer fires every few lines of scrolling...
                //We invalidate because user can change columns and I cba with that.
                indexCache = {idx, numCols: dom.length, firstIdx: idx[Object.keys(idx)[0]]};
                setTimeout(() => indexCache = undefined, 5000);
                return indexCache;
            }
            function addStats(dom) {
                let stats, {idx, numCols, firstIdx} = indexColumns();
                dom = chunkArrayLike(dom, numCols);
                for (let row of dom) {
                    if (!row[firstIdx].hasExStats) {
                        stats = getFormattedStats(row, idx);
                        for (let stat in idx) {
                            if (stats[stat]) {
                                let cell = row[idx[stat]];
                                cell.firstElementChild.firstElementChild.innerHTML += stats[stat];
                                cell.hasExStats = true;
                            }
                        }
                    }
                }
            }
            function getFormattedStats(dom, {likes, bookmarks, views, date}) {
                function formatStat(value, precision, suffix) {
                    return ` (<span class="exStats">${value.toFixed(precision)}</span>${suffix})`;
                }
                let stats = {};
                if (views) {
                    views = getNumber(dom[views].textContent);
                    if (likes) {
                        likes = getNumber(dom[likes].textContent);
                        stats.likes = formatStat((likes / views * 100), 2, "%");
                    }
                    if (bookmarks) {
                        bookmarks = getNumber(dom[bookmarks].textContent);
                        stats.bookmarks = formatStat((bookmarks / views * 100), 2, "%");
                    }
                    if (date) {
                        date = new Date(dom[date].textContent);
                        stats.views = formatStat((views / Math.max(((Date.now() - date) / 86400000), 1)), 0, "");
                    }
                }
                return stats         
            }

            waitOn("div.sc-1b2i4p6-25", e => {
                // iirc getElementsByClassName returns consistently in-order so that's why we use it.
                const values = document.getElementsByClassName("sc-1b2i4p6-25"); // Live!
                const OBSERVER = new MutationObserver(m => {
                    m.some(r => {
                        if (r.addedNodes.length && r.addedNodes[0].className.startsWith("sc-1b2i4p6-25")) {
                            addStats(values);
                            console.log("Rebuilding stats");
                            return true;
                        }
                    });
                });
                OBSERVER.observe(document.getElementsByClassName("sc-1b2i4p6-2")[0], {childList: true});
                addStats(values);
            });
        }
        
        // Helpers
        function getNumber(n) {
            if (n) {
                return parseInt(n.replaceAll(",", ""));
            }
        }
        function injectCSS() {
            let css = document.createElement("style");
            css.type = "text/css";

            css.innerHTML = ".exStats {color: rgb(0, 150, 250);}";
            document.head.appendChild(css);
        }
        function peekFetch() {
            window.oFetch = fetch;
            window.fetch = function (url, opt) {
                let m = url.match(re_newPixiv);
                if (m) {
                    if (m[1]) {
                        homePage();
                    }
                    else if (m[2]) {
                        worksPage();
                    }
                }
                return window.oFetch(url, opt);
            };
        }
        function chunkArrayLike(a, size) {
            let r = [];
            for (let i = 0; i < a.length; i += size) {
                r.push( Array.prototype.slice.call(a, i, i + size) );
            }
            return r;
        }
    }

    //Code by cromachina
    function oldPixiv() {
        document.body.querySelectorAll('li[class="image-item"]').forEach(function (node)
        {
            let bookmark_node = node.querySelector('a[class*="bookmark-count"]');
            let view_node = node.querySelector('a[class*="views"] span');
            if (bookmark_node && view_node)
            {
                let bookmark_count = parseInt(bookmark_node.text);
                let views = parseInt(view_node.textContent);
                let bookmark_percent = (bookmark_count / views * 100).toFixed(2);
                bookmark_node.append(` (${bookmark_percent}%)`);
            }
        });
    }

    //Helpers
    function waitOn(selector, action, interval) {
        let elm = document.querySelector(selector);
        if (elm) action(elm);
        else setTimeout(() => waitOn(selector, action, interval), interval || 500);
    }
})();