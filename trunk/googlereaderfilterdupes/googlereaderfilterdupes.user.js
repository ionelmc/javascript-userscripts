// ==UserScript==
// @name           GoogleReaderFilterDupes
// @namespace      webmonkey
// @description    Filter dupes from a folder in Google Reader
// @include        http://reader.google.com/reader/*
// @include        https://reader.google.com/reader/*
// @include        http://www.google.com/reader/*
// @include        https://www.google.com/reader/*
// ==/UserScript==  
var E = [], T = [];
var ematch = /entry(?!-\S)/;
function main_init() {
  $('chrome-header').addEventListener('DOMNodeInserted', function (event) {
    if (document.body.className.indexOf('loading') == -1) {
      E.splice(0);
      T.splice(0);
    }
  }, true);
  $('entries').addEventListener('DOMNodeInserted', function (event) {
    if (ematch.exec(event.target.className).length) {
      var a = $x('//a[contains(@class, "entry-original")]', event.target).pop();
      var t = $x('//h2[contains(@class,"entry-title")]', event.target).pop();
      if (E.indexOf(a.href) >= 0 || T.indexOf(t.textContent) >= 0) {
        GM_log('Removing: ' + t.textContent);
        event.target.parentNode.removeChild(event.target);
        //~ event.target.style.fontFamily = 'courier';
      } 
      E.push(a.href);
      T.push(t.textContent);
      
    }
  }, true);
}
function init () {
  var subs = document.getElementsByClassName('sub');
  var entries = $('entries');
  if(!subs.length && !entries) {
    setTimeout(init,100); return;
  }
  main_init();
};
init();

function $x(p, context) {
  if (!context) context = document;
  var i, arr = [], xpr = document.evaluate(p, context, null, 
                            XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
  for (i = 0; item = xpr.snapshotItem(i); i++) arr.push(item);
  return arr;
}

function $(id) {
  return document.getElementById(id);
}
