// ==UserScript==
// @name           Fix links in personalized search
// @namespace      webmonkey
// @description    Fix the javascript handlers that mudge the link's href attributes with redirect urls on mousedown in personalized search. You can copy the link's real address from the context menu with this userscript.
// @include        http://www.google.*/search?*
// ==/UserScript==

var links = $x("//h3//a[@onmousedown]");
for (var i=0; i<links.length; i++) {
  var a = links[i];
  a.addEventListener('click', i_know_how_to_handle, true);
  a.setAttribute('crap_handler', a.getAttribute('onmousedown'));
  a.setAttribute('onmousedown', "");
  
}
delete links;

var rwt = unsafeWindow.rwt; // 

function i_know_how_to_handle(event) {
  event.preventDefault();
  var el = event.target;
  var fake_el = {href:el.getAttribute('href')};
  var handler = new Function(el.getAttribute('crap_handler'));
  document.location = fake_el.href;
}

////////// utils

function $(id) {
  return document.getElementById(id);
}

function $x(p, context) {
  if (!context) context = document;
  var i, arr = [], xpr = document.evaluate(p, context, null, 
                            XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
  for (i = 0; item = xpr.snapshotItem(i); i++) arr.push(item);
  return arr;
}
