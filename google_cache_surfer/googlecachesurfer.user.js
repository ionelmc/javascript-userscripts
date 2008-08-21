// ==UserScript==
// @name           GoogleCacheSurfer
// @namespace      webmonkey
// @description    Change the links from the cached page to point to cached pages. No extra styling crap, dead-simple. Keeps the links in google's header untouched.
// @include        http://*/search?*q=cache%3A*
// @include        http://*/search?*q=cache%3a*
// @include        http://*/search?*q=cache:*
// ==/UserScript==

var links = document.links;
JSM = /javascript:.*/;
ABSM = /https?\:\/\/.*/;
for (var i=0; i<links.length; i++) {
    var link = links[i];
    var href = link.href;
    var test = link.parentNode;
    while (test && test != document.body.firstChild) 
        test = test.parentNode;
    if (!test && !JSM.exec(href)) {
        if (ABSM.exec(href)) {
            link.href = "http://www.google.com/search?q=cache%3A" + encodeURIComponent(link.href);
        } else {
            link.href = "http://www.google.com/search?q=cache%3A" + encodeURIComponent(document.baseURI+link.href);
        }
    }
}