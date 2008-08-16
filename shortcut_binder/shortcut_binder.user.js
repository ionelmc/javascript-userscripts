// ==UserScript==
// @name            Shortcut Binder
// @namespace       ShortcutBinder
// @description     Tool to bind certain shortcuts to clickable elements.
// @include         *
// @revision        $Revision$
// @id              $Id$
// @date            $Date$
// @source          $URL$
// @author          $Author$
// ==/UserScript==

GM_registerMenuCommand("Set shortcut for bind dialog", SetOptions, "k");
GM_registerMenuCommand("Add manual bind", BindDialog, "b");
HandlePageCombo();

var KEYS = { altKey:'Alt', ctrlKey:'Ctrl', metaKey:'Meta', shiftKey:'Shift', charCode:'' };

var binddialog_opened = false, bindings_map = filterBindings();
bindings_map.forEach(function(h) {
    GM_log(uneval(h));
})

function filterBindings(bindings) {
    if (!bindings) 
        bindings = deserialize("bindings", "[]");
    return bindings.filter(function(el) {
        return testMatch(el.include) && !testMatch(el.exclude);
    });
}   

function testMatch(expr) {
    return convert2RegExp(expr).test(window.location.href);
}

function HandlePageCombo() {
    var combo = {};
    function listener(event) {
        for (var key in KEYS) {
            combo[key] = event[key];
        }
        if (keyHashEq(combo, deserialize("bindDialogShortcut"))) {
            event.preventDefault();
            event.stopPropagation();
            if (!binddialog_opened) BindDialog();
            return;
        }
        for (var i=0; i<bindings_map.length; i++) {
            var binding = bindings_map[i];

            GM_log(
                uneval(combo)+", "+
                uneval(binding.bind)+", "+
                keyHashEq(combo, binding.bind)+", "+
                testMatch(binding.include)+", "+
                !testMatch(binding.exclude)
            );
            
            if (keyHashEq(combo, binding.bind) && testMatch(binding.include) && !testMatch(binding.exclude)) {
                var match;
                try {
                    match = $x(binding.xpath)
                } catch(exc) {
                    GM_log("Match expression << "+binding.xpath+" >> failed with: "+exc);
                    continue;
                }
                if (match.length > 1)
                    GM_log("We've matched "+match.length+" elements. We'll use the first one.");
                if (match.length >= 1) {
                    var m = match[0];
                    if (m.click) {
                        GM_log("Clicking: "+m.click());
                    } else {
                        GM_log("Match didn't had a click method ! Creating event...");
                        //first focus it.
                        triggerEvent(m, 'focus');
                        
                        //try the click event
                        var savedEvent = null;
                        m.addEventListener('click', function(evt) {
                            savedEvent = evt;
                        }, false);
                        
                        
                        var evt = document.createEvent('MouseEvents');
                        evt.initMouseEvent(
                            'click', true, true, document.defaultView, 1, 
                            getElementPosition(m), getElementPosition(m, true), 
                            getElementPosition(m), getElementPosition(m, true),
                            false, false, false, false, 0, m
                        );
                        evt.initEvent('click', false, true);
                        m.dispatchEvent(evt);
                        
                        if (savedEvent != null && !savedEvent.getPreventDefault()) {
                            if (m.href) { 
                                window.location.href = m.href;
                            } else {
                                GM_log("Matched element didn't have a href !");
                            }
                        } else {
                            GM_log("Matched element canceled the click event.");
                        }
                        event.preventDefault();
                        event.stopPropagation();
                    }   
                } else {
                    GM_log("Match expression << "+binding.xpath+" >> matched: "+match.length+" elements (should match only 1).");
                }
            }
            
        }
        
    }
    document.addEventListener('keypress', listener, true);
}


function BindDialog() {
    binddialog_opened = true;
    var form, path_input, binding_input, include_input, exclude_input, 
        close_button, dialog_selected=false, outlined_element, header, 
        offsetx, offsety, suggestions, matched_element, computeds = [],
        binding = {};
    function cleanup() {
        document.body.removeChild(form);
        window.removeEventListener('keypress', remove, true);
        document.removeEventListener("click", element_click, true);
        document.removeEventListener("mousemove", element_mouseMove, false);
        document.removeEventListener("mouseover", element_mouseOver, false);
        if (outlined_element) outlined_element.style.MozOutline = '';
        for (var i=0; i<computeds.length; i++) 
            computeds[i].style.MozOutline = '';
        serialize("bindDialog-posX", form.style.left);
        serialize("bindDialog-posY", form.style.top);
        binddialog_opened = false;
    }
    function save(event) {
        bindings_map = deserialize("bindings", "[]").filter(function(el) {
            return el.xpath != path_input.value 
                || !keyHashEq(el.bind, binding)
                || el.include != include_input.value
                || el.exclude != exclude_input.value;
        });
        GM_log(uneval(bindings_map));
        bindings_map.push({
            xpath:path_input.value, 
            bind:binding, 
            include:include_input.value, 
            exclude:exclude_input.value 
        });
        serialize("bindings", bindings_map);
        cleanup();
        bindings_map = filterBindings(bindings_map);
    }
    function remove(event) {
        if (event.charCode == 0 && event.keyCode == 27) {
            event.preventDefault();
            event.stopPropagation();
            cleanup();
        }
    }
    
    function element_mouseOver(event) {
        //~ GM_log('mouseOver'+ event.target.innerHTML);
    }
    function element_mouseMove(event) {
        if (dialog_selected) {
            form.style.left = (event.clientX-offsetx)+'px';
            form.style.top = (event.clientY-offsety)+'px';
        } else {            
            var element = event.target;
            if (element) {
                var owner = element.ownerDocument;
                if (owner) {
                    if (element!=form && !isAncestor(element, form)) {
                        if (outlined_element) 
                            if (!computeds.some(function(el) {return el==outlined_element})) 
                                outlined_element.style.MozOutline = '';
                        if (!computeds.some(function(el) {return el==element})) {
                            outlined_element = element;
                            outlined_element.style.MozOutline = '1px solid blue';
                        }
                    }
                }
            }
        }
        event.preventDefault();
        event.stopPropagation();
        //~ GM_log('mouseMove', event.target.innerHTML);
    }   
    function element_click(event) {
        var element = event.target;
        if (element && element!=form && !isAncestor(element, form)) {
            var val = computeXPath(element);
            path_input.value = val;
            path_changed(null, val);
            binding_input.focus();
            event.preventDefault();
            event.stopPropagation();
        }
        //~ GM_log('elementClick', event.target.innerHTML);
    }
    function path_changed(event, value) {
        for (var i=0; i<computeds.length; i++) {
            if (computeds[i].style)
                computeds[i].style.MozOutline = '';
        }
        var computed;
        try { 
            //~ GM_log(value||path_input.value);
            computed = $x(value||path_input.value).filter(function(el) {
                return el!=form && !isAncestor(el, form);
            });
        } catch (exc) {
            suggestions.textContent = "ERROR:"+exc;
            path_input.style.background = 'red';
            computeds = [];
            return;
        }
        computeds = computed;
        if (computed.length == 1) {
            suggestions.textContent = "Excelent, we've matched 1 node !";
            if (computed[0]) 
                computed[0].style.MozOutline = '2px dashed green';
            path_input.style.background = 'lightgreen';
        }
        if (computed.length > 1) {
            suggestions.textContent = "Bad, we've matched "+computed.length+" nodes !";
            for (var i=0; i<computed.length; i++) {
                if (computeds[i].style) 
                    computed[i].style.MozOutline = '2px dashed red';
            }
            path_input.style.background = 'yellow';
        }
        if (computed.length == 0) {
            suggestions.textContent = "Worse, we've matched 0 nodes !";
            path_input.style.background = 'red';
        }
    }
    
    document.body.appendChild(
     form=EL('div', { id:"ShortcutBinderAddDialog", 
                      style:'top:'+deserialize("bindDialog-posY", "'50px'")+
                           ';left:'+deserialize("bindDialog-posX", "'50px'")},
      header=EL('h2', {}, 'Add new binding'),
      EL('label', {}, "XPath to element:", path_input=EL('textarea', {wrap:'hard'})),  
      suggestions=EL('div', {'class':'suggestions'}, ''),
      EL('label', {}, "Shortcut:", binding_input=EL('input', {type: 'input'})),  
      EL('label', {}, "Run on pages matching:", include_input=EL('input', {type: 'input', value:'*'})),  
      EL('label', {}, "Exclude pages matching:", exclude_input=EL('input', {type: 'input', value:''})),  
      close_button=EL('input', {type: 'button', value:'Save', 'onclick':save})
     )
    )
    
    form.addEventListener('keypress', remove, true);
    form.focus();
    
    window.addEventListener('keypress', remove, true);
    
    header.addEventListener('mousedown', function(event) {
        dialog_selected = true;
        offsetx = event.clientX-getElementPosition(event.target, true);
        offsety = event.clientY-getElementPosition(event.target, false);
        event.preventDefault();
        event.stopPropagation();
    }, true);
    
    header.addEventListener('mouseup', function(event) {
        dialog_selected = false;
        event.preventDefault();
        event.stopPropagation();
    }, true);
    path_input.addEventListener('change', path_changed, true);
    path_input.addEventListener('keyup',  path_changed, true);
    
    document.addEventListener("click", element_click, true);
    document.addEventListener("mousemove", element_mouseMove, false);
    document.addEventListener("mouseover", element_mouseOver, false);
    function update() {
        binding_input.value = shortcutToString(binding);
        close_button.focus();
    }
    HandleKeypress(binding, binding_input, update);    
}
function computePath(element) {
    var path = []
    while (element.parentNode) {
        path.push({
            name:element.tagName,
            'class':element.className,
            id:element.id,
            element:element
        })
        element = element.parentNode;
    }
    return path;
}
function computeXPath(element) {
    var path = computePath(element);
    var xpath = '';
    for (var i=0; i<path.length; i++) {
        var tok = path[i];
        var expr = [];
        var p = tok.element.firstChild;
        while (p && p.nodeType!=Node.ELEMENT_NODE)
            p = p.nextSibling;
        if (tok.element.textContent && !p && i==0) {
            expr.push("(text()='"+element.textContent+"')");
        } 
        if (tok.element.value) {
            expr.push("(@value='"+tok.element.value+"')");
        }
        if (tok.name) {
            if (tok['class'])
                expr.push("(@class='" + tok['class'] + "')");
            if (tok.id)
                expr.push("(@id='" + tok.id + "')");
            xpath = '/' + tok.name.toLowerCase() + (expr.length?('[' + expr.join(' and ') + ']'):'') + xpath;
        }
    }
    return xpath;
}

function HandleKeypress(shortcut, shortcut_input, callback) {
    function listener(event) {
        if (!event.charCode) return;
        //~ GM_log(shortcut+':'+typeof shortcut);
        var out = []
        for (var key in KEYS) {
            shortcut[key] = event[key];
        }
        
        if (callback) callback();
        event.preventDefault();
        event.stopPropagation();
    }
    shortcut_input.addEventListener('keypress', listener, true);
    return listener;
}

function SetOptions() {
    var close_button, form, shortcut_input, shortcut=deserialize("bindDialogShortcut");
    function save(event) {
        serialize("bindDialogShortcut", shortcut);
        document.body.removeChild(form);
        window.removeEventListener('keypress', remove, true);
    }
    function update() {
        shortcut_input.value = shortcutToString(shortcut);
        close_button.focus();
    }
    function remove(event) {
        if (event.charCode == 0 && event.keyCode == 27) {
            event.preventDefault();
            event.stopPropagation();
            document.body.removeChild(form);
            window.removeEventListener('keypress', remove, true);
        }
    }
        
    document.body.appendChild(
     form=EL('div', {id: 'ShortcutBinderGlobalDialog'}, 
      EL('h2', {}, "Shortcut for bind dialog"), EL('br'),
      EL('label', {}, "Shortcut:", shortcut_input=EL('input', {
          type: 'input', value:shortcutToString(shortcut)
      })),
      close_button=EL('input', {type: 'button', value:'Save', 'onclick':save})
     )
    );
    HandleKeypress(shortcut, shortcut_input, update);
    form.addEventListener('keypress', remove, true);
    window.addEventListener('keypress', remove, true);
    shortcut_input.focus();
}
    
    
    
    
    
////////////////////////////////////////////////////////////////////////////////
// utility functions

function triggerEvent(element, eventType, canBubble, controlKeyDown, altKeyDown, shiftKeyDown, metaKeyDown) {
    canBubble = (typeof(canBubble) == undefined) ? true : canBubble;
    var evt = document.createEvent('HTMLEvents');
    
    try {
        evt.shiftKey = shiftKeyDown;
        evt.metaKey = metaKeyDown;
        evt.altKey = altKeyDown;
        evt.ctrlKey = controlKeyDown;
    } catch (e) {
        // On Firefox 1.0, you can only set these during initMouseEvent or initKeyEvent
        // we'll have to ignore them here
        LOG.exception(e);
    }
    
    evt.initEvent(eventType, canBubble, true);
    element.dispatchEvent(evt);
}

function getElementPosition(element, xPosition) { 
    var position = 0;

    // If the element is set
    if(element)
    {
        var elementOffsetParent = element.offsetParent;

        // If the element has an offset parent
        if(elementOffsetParent)
        {
            // While there is an offset parent
            while((elementOffsetParent = element.offsetParent) != null)
            {
                // If getting the x position
                if(xPosition)
                {
                    position += element.offsetLeft;
                }
                else
                {
                    position += element.offsetTop;
                }

                element = elementOffsetParent;
            }
        }
        else
        {
            // If getting the x position
            if(xPosition)
            {
                position = element.offsetLeft;
            }
            else
            {
                position = element.offsetTop;
            }
        }
    }

    return position;
}


function shortcutToString(shortcut) {
    var out = [];
    for (var key in KEYS) if (shortcut[key])
        out.push(KEYS[key] || String.fromCharCode(shortcut[key]).toUpperCase());
    return out.join(" + ");
}


function keyHashEq(hash1, hash2) {
    for (var key in KEYS) {
        if (hash1[key] != hash2[key]) 
            return false;
    }
    return true;
}

function deserialize(name, def) {
  return eval(GM_getValue(name, (def || '({})')));
}

function serialize(name, val) {
  GM_setValue(name, uneval(val));
}

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

function TEXT(str){
    return document.createTextNode(str);
}

function EL(type, attributes){
    var node = document.createElement(type);
    for (var i=2; i<arguments.length; i++) {
        var child=arguments[i];
        if (child) { 
            if (typeof(child)=='string') {
                node.appendChild(TEXT(child));
            } else {
                node.appendChild(child);
            }
        }
    }
    for (var attr in attributes) if (attributes.hasOwnProperty(attr)){
        if (attr.slice(0,2) == 'on') {
            node.addEventListener(attr.slice(2), attributes[attr], false);
        } else {
            node.setAttribute(attr, attributes[attr]);
        }
    }
    return node;
} 


// Gets all the documents from the current page
function getDocuments(frame)
{
    var documents = new Array();

    // If the frame is set
    if(frame)
    {
        var frames       = frame.frames;
        var framesLength = frames.length;

        // If the frame document exists
        if(frame.document)
        {
            documents.push(frame.document);
        }

        // Loop through the frames
        for(var i = 0; i < framesLength; i++)
        {
            documents = documents.concat(getDocuments(frames[i]));
        }
    }

    return documents;
}
function isAncestor(element, ancestorElement) {
    // If the element and ancestor element are set
    if(element && ancestorElement)
    {
        var parentElement = null;

        // Loop through the parent elements
        while((parentElement = element.parentNode) != null)
        {
            // If the parent element is the ancestor element
            if(parentElement == ancestorElement)
            {
                return true;
            }
            else
            {
                element = parentElement;
            }
        }
    }

    return false;
}

// Converts a pattern in this programs simple notation to a regular expression.
// thanks AdBlock! http://www.mozdev.org/source/browse/adblock/adblock/
function convert2RegExp( pattern ) {
  var s = new String(pattern);
  var res = new String("^");

  for (var i = 0 ; i < s.length ; i++) {
    switch(s[i]) {
      case "*" :
        res += ".*";
        break;

      case "." :
      case "?" :
      case "^" :
      case "$" :
      case "+" :
      case "{" :
      case "[" :
      case "|" :
      case "(" :
      case ")" :
      case "]" :
        res += "\\" + s[i];
        break;

      case "\\" :
        res += "\\\\";
        break;

      case " " :
        // Remove spaces from URLs.
        break;

      default :
        res += s[i];
        break;
    }
  }

  var tldRegExp = new RegExp("^(\\^(?:[^/]*)(?://)?(?:[^/]*))(\\\\\\.tld)((?:/.*)?)$")
  var tldRes = res.match(tldRegExp);
  if (tldRes) {
    // build the mighty TLD RegExp
    var tldStr = "\.(?:demon\\.co\\.uk|esc\\.edu\\.ar|(?:c[oi]\\.)?[^\\.]\\.(?:vt|ne|ks|il|hi|sc|nh|ia|wy|or|ma|vi|tn|in|az|id|nc|co|dc|nd|me|al|ak|de|wv|nm|mo|pr|nj|sd|md|va|ri|ut|ct|pa|ok|ky|mt|ga|la|oh|ms|wi|wa|gu|mi|tx|fl|ca|ar|mn|ny|nv)\\.us|[^\\.]\\.(?:(?:pvt\\.)?k12|cc|tec|lib|state|gen)\\.(?:vt|ne|ks|il|hi|sc|nh|ia|wy|or|ma|vi|tn|in|az|id|nc|co|dc|nd|me|al|ak|de|wv|nm|mo|pr|nj|sd|md|va|ri|ut|ct|pa|ok|ky|mt|ga|la|oh|ms|wi|wa|gu|mi|tx|fl|ca|ar|mn|ny|nv)\\.us|[^\\.]\\.vt|ne|ks|il|hi|sc|nh|ia|wy|or|ma|vi|tn|in|az|id|nc|co|dc|nd|me|al|ak|de|wv|nm|mo|pr|nj|sd|md|va|ri|ut|ct|pa|ok|ky|mt|ga|la|oh|ms|wi|wa|gu|mi|tx|fl|ca|ar|mn|ny|nvus|ne|gg|tr|mm|ki|biz|sj|my|hn|gl|ro|tn|co|br|coop|cy|bo|ck|tc|bv|ke|aero|cs|dm|km|bf|af|mv|ls|tm|jm|pg|ky|ga|pn|sv|mq|hu|za|se|uy|iq|ai|com|ve|na|ba|ph|xxx|no|lv|tf|kz|ma|in|id|si|re|om|by|fi|gs|ir|li|tz|td|cg|pa|am|tv|jo|bi|ee|cd|pk|mn|gd|nz|as|lc|ae|cn|ag|mx|sy|cx|cr|vi|sg|bm|kh|nr|bz|vu|kw|gf|al|uz|eh|int|ht|mw|gm|bg|gu|info|aw|gy|ac|ca|museum|sk|ax|es|kp|bb|sa|et|ie|tl|org|tj|cf|im|mk|de|pro|md|fm|cl|jp|bn|vn|gp|sm|ar|dj|bd|mc|ug|nu|ci|dk|nc|rw|aq|name|st|hm|mo|gq|ps|ge|ao|gr|va|is|mt|gi|la|bh|ms|bt|gb|it|wf|sb|ly|ng|gt|lu|il|pt|mh|eg|kg|pf|um|fr|sr|vg|fj|py|pm|sn|sd|au|sl|gh|us|mr|dz|ye|kn|cm|arpa|bw|lk|mg|tk|su|sc|ru|travel|az|ec|mz|lb|ml|bj|edu|pr|fk|lr|nf|np|do|mp|bs|to|cu|ch|yu|eu|mu|ni|pw|pl|gov|pe|an|ua|uk|gw|tp|kr|je|tt|net|fo|jobs|yt|cc|sh|io|zm|hk|th|so|er|cz|lt|mil|hr|gn|be|qa|cv|vc|tw|ws|ad|sz|at|tg|zw|nl|info\\.tn|org\\.sd|med\\.sd|com\\.hk|org\\.ai|edu\\.sg|at\\.tt|mail\\.pl|net\\.ni|pol\\.dz|hiroshima\\.jp|org\\.bh|edu\\.vu|net\\.im|ernet\\.in|nic\\.tt|com\\.tn|go\\.cr|jersey\\.je|bc\\.ca|com\\.la|go\\.jp|com\\.uy|tourism\\.tn|com\\.ec|conf\\.au|dk\\.org|shizuoka\\.jp|ac\\.vn|matsuyama\\.jp|agro\\.pl|yamaguchi\\.jp|edu\\.vn|yamanashi\\.jp|mil\\.in|sos\\.pl|bj\\.cn|net\\.au|ac\\.ae|psi\\.br|sch\\.ng|org\\.mt|edu\\.ai|edu\\.ck|ac\\.yu|org\\.ws|org\\.ng|rel\\.pl|uk\\.tt|com\\.py|aomori\\.jp|co\\.ug|video\\.hu|net\\.gg|org\\.pk|id\\.au|gov\\.zw|mil\\.tr|net\\.tn|org\\.ly|re\\.kr|mil\\.ye|mil\\.do|com\\.bb|net\\.vi|edu\\.na|co\\.za|asso\\.re|nom\\.pe|edu\\.tw|name\\.et|jl\\.cn|gov\\.ye|ehime\\.jp|miyazaki\\.jp|kanagawa\\.jp|gov\\.au|nm\\.cn|he\\.cn|edu\\.sd|mod\\.om|web\\.ve|edu\\.hk|medecin\\.fr|org\\.cu|info\\.au|edu\\.ve|nx\\.cn|alderney\\.gg|net\\.cu|org\\.za|mb\\.ca|com\\.ye|edu\\.pa|fed\\.us|ac\\.pa|alt\\.na|mil\\.lv|fukuoka\\.jp|gen\\.in|gr\\.jp|gov\\.br|gov\\.ac|id\\.fj|fukui\\.jp|hu\\.com|org\\.gu|net\\.ae|mil\\.ph|ltd\\.je|alt\\.za|gov\\.np|edu\\.jo|net\\.gu|g12\\.br|org\\.tn|store\\.co|fin\\.tn|ac\\.nz|gouv\\.fr|gov\\.il|org\\.ua|org\\.do|org\\.fj|sci\\.eg|gov\\.tt|cci\\.fr|tokyo\\.jp|net\\.lv|gov\\.lc|ind\\.br|ca\\.tt|gos\\.pk|hi\\.cn|net\\.do|co\\.tv|web\\.co|com\\.pa|com\\.ng|ac\\.ma|gov\\.bh|org\\.zw|csiro\\.au|lakas\\.hu|gob\\.ni|gov\\.fk|org\\.sy|gov\\.lb|gov\\.je|ed\\.cr|nb\\.ca|net\\.uy|com\\.ua|media\\.hu|com\\.lb|nom\\.pl|org\\.br|hk\\.cn|co\\.hu|org\\.my|gov\\.dz|sld\\.pa|gob\\.pk|net\\.uk|guernsey\\.gg|nara\\.jp|telememo\\.au|k12\\.tr|org\\.nz|pub\\.sa|edu\\.ac|com\\.dz|edu\\.lv|edu\\.pk|com\\.ph|net\\.na|net\\.et|id\\.lv|au\\.com|ac\\.ng|com\\.my|net\\.cy|unam\\.na|nom\\.za|net\\.np|info\\.pl|priv\\.hu|rec\\.ve|ac\\.uk|edu\\.mm|go\\.ug|ac\\.ug|co\\.dk|net\\.tt|oita\\.jp|fi\\.cr|org\\.ac|aichi\\.jp|org\\.tt|edu\\.bh|us\\.com|ac\\.kr|js\\.cn|edu\\.ni|com\\.mt|fam\\.pk|experts-comptables\\.fr|or\\.kr|org\\.au|web\\.pk|mil\\.jo|biz\\.pl|org\\.np|city\\.hu|org\\.uy|auto\\.pl|aid\\.pl|bib\\.ve|mo\\.cn|br\\.com|dns\\.be|sh\\.cn|org\\.mo|com\\.sg|me\\.uk|gov\\.kw|eun\\.eg|kagoshima\\.jp|ln\\.cn|seoul\\.kr|school\\.fj|com\\.mk|e164\\.arpa|rnu\\.tn|pro\\.ae|org\\.om|gov\\.my|net\\.ye|gov\\.do|co\\.im|org\\.lb|plc\\.co\\.im|net\\.jp|go\\.id|net\\.tw|gov\\.ai|tlf\\.nr|ac\\.im|com\\.do|net\\.py|tozsde\\.hu|com\\.na|tottori\\.jp|net\\.ge|gov\\.cn|org\\.bb|net\\.bs|ac\\.za|rns\\.tn|biz\\.pk|gov\\.ge|org\\.uk|org\\.fk|nhs\\.uk|net\\.bh|tm\\.za|co\\.nz|gov\\.jp|jogasz\\.hu|shop\\.pl|media\\.pl|chiba\\.jp|city\\.za|org\\.ck|net\\.id|com\\.ar|gon\\.pk|gov\\.om|idf\\.il|net\\.cn|prd\\.fr|co\\.in|or\\.ug|red\\.sv|edu\\.lb|k12\\.ec|gx\\.cn|net\\.nz|info\\.hu|ac\\.zw|info\\.tt|com\\.ws|org\\.gg|com\\.et|ac\\.jp|ac\\.at|avocat\\.fr|org\\.ph|sark\\.gg|org\\.ve|tm\\.pl|net\\.pg|gov\\.co|com\\.lc|film\\.hu|ishikawa\\.jp|hotel\\.hu|hl\\.cn|edu\\.ge|com\\.bm|ac\\.om|tec\\.ve|edu\\.tr|cq\\.cn|com\\.pk|firm\\.in|inf\\.br|gunma\\.jp|gov\\.tn|oz\\.au|nf\\.ca|akita\\.jp|net\\.sd|tourism\\.pl|net\\.bb|or\\.at|idv\\.tw|dni\\.us|org\\.mx|conf\\.lv|net\\.jo|nic\\.in|info\\.vn|pe\\.kr|tw\\.cn|org\\.eg|ad\\.jp|hb\\.cn|kyonggi\\.kr|bourse\\.za|org\\.sb|gov\\.gg|net\\.br|mil\\.pe|kobe\\.jp|net\\.sa|edu\\.mt|org\\.vn|yokohama\\.jp|net\\.il|ac\\.cr|edu\\.sb|nagano\\.jp|travel\\.pl|gov\\.tr|com\\.sv|co\\.il|rec\\.br|biz\\.om|com\\.mm|com\\.az|org\\.vu|edu\\.ng|com\\.mx|info\\.co|realestate\\.pl|mil\\.sh|yamagata\\.jp|or\\.id|org\\.ae|greta\\.fr|k12\\.il|com\\.tw|gov\\.ve|arts\\.ve|cul\\.na|gov\\.kh|org\\.bm|etc\\.br|or\\.th|ch\\.vu|de\\.tt|ind\\.je|org\\.tw|nom\\.fr|co\\.tt|net\\.lc|intl\\.tn|shiga\\.jp|pvt\\.ge|gov\\.ua|org\\.pe|net\\.kh|co\\.vi|iwi\\.nz|biz\\.vn|gov\\.ck|edu\\.eg|zj\\.cn|press\\.ma|ac\\.in|eu\\.tt|art\\.do|med\\.ec|bbs\\.tr|gov\\.uk|edu\\.ua|eu\\.com|web\\.do|szex\\.hu|mil\\.kh|gen\\.nz|okinawa\\.jp|mob\\.nr|edu\\.ws|edu\\.sv|xj\\.cn|net\\.ru|dk\\.tt|erotika\\.hu|com\\.sh|cn\\.com|edu\\.pl|com\\.nc|org\\.il|arts\\.co|chirurgiens-dentistes\\.fr|net\\.pa|takamatsu\\.jp|net\\.ng|org\\.hu|net\\.in|net\\.vu|gen\\.tr|shop\\.hu|com\\.ae|tokushima\\.jp|za\\.com|gov\\.eg|co\\.jp|uba\\.ar|net\\.my|biz\\.et|art\\.br|ac\\.fk|gob\\.pe|com\\.bs|co\\.ae|de\\.net|net\\.eg|hyogo\\.jp|edunet\\.tn|museum\\.om|nom\\.ve|rnrt\\.tn|hn\\.cn|com\\.fk|edu\\.dz|ne\\.kr|co\\.je|sch\\.uk|priv\\.pl|sp\\.br|net\\.hk|name\\.vn|com\\.sa|edu\\.bm|qc\\.ca|bolt\\.hu|per\\.kh|sn\\.cn|mil\\.id|kagawa\\.jp|utsunomiya\\.jp|erotica\\.hu|gd\\.cn|net\\.tr|edu\\.np|asn\\.au|com\\.gu|ind\\.tn|mil\\.br|net\\.lb|nom\\.co|org\\.la|mil\\.pl|ac\\.il|gov\\.jo|com\\.kw|edu\\.sh|otc\\.au|gmina\\.pl|per\\.sg|gov\\.mo|int\\.ve|news\\.hu|sec\\.ps|ac\\.pg|health\\.vn|sex\\.pl|net\\.nc|qc\\.com|idv\\.hk|org\\.hk|gok\\.pk|com\\.ac|tochigi\\.jp|gsm\\.pl|law\\.za|pro\\.vn|edu\\.pe|info\\.et|sch\\.gg|com\\.vn|gov\\.bm|com\\.cn|mod\\.uk|gov\\.ps|toyama\\.jp|gv\\.at|yk\\.ca|org\\.et|suli\\.hu|edu\\.my|org\\.mm|co\\.yu|int\\.ar|pe\\.ca|tm\\.hu|net\\.sb|org\\.yu|com\\.ru|com\\.pe|edu\\.kh|edu\\.kw|org\\.qa|med\\.om|net\\.ws|org\\.in|turystyka\\.pl|store\\.ve|org\\.bs|mil\\.uy|net\\.ar|iwate\\.jp|org\\.nc|us\\.tt|gov\\.sh|nom\\.fk|go\\.th|gov\\.ec|com\\.br|edu\\.do|gov\\.ng|pro\\.tt|sapporo\\.jp|net\\.ua|tm\\.fr|com\\.lv|com\\.mo|edu\\.uk|fin\\.ec|edu\\.ps|ru\\.com|edu\\.ec|ac\\.fj|net\\.mm|veterinaire\\.fr|nom\\.re|ingatlan\\.hu|fr\\.vu|ne\\.jp|int\\.co|gov\\.cy|org\\.lv|de\\.com|nagasaki\\.jp|com\\.sb|gov\\.za|org\\.lc|com\\.fj|ind\\.in|or\\.cr|sc\\.cn|chambagri\\.fr|or\\.jp|forum\\.hu|tmp\\.br|reklam\\.hu|gob\\.sv|com\\.pl|saitama\\.jp|name\\.tt|niigata\\.jp|sklep\\.pl|nom\\.ni|co\\.ma|net\\.la|co\\.om|pharmacien\\.fr|port\\.fr|mil\\.gu|au\\.tt|edu\\.gu|ngo\\.ph|com\\.ve|ac\\.th|gov\\.fj|barreau\\.fr|net\\.ac|ac\\.je|org\\.kw|sport\\.hu|ac\\.cn|net\\.bm|ibaraki\\.jp|tel\\.no|org\\.cy|edu\\.mo|gb\\.net|kyoto\\.jp|sch\\.sa|com\\.au|edu\\.lc|fax\\.nr|gov\\.mm|it\\.tt|org\\.jo|nat\\.tn|mil\\.ve|be\\.tt|org\\.az|rec\\.co|co\\.ve|gifu\\.jp|net\\.th|hokkaido\\.jp|ac\\.gg|go\\.kr|edu\\.ye|qh\\.cn|ab\\.ca|org\\.cn|no\\.com|co\\.uk|gov\\.gu|de\\.vu|miasta\\.pl|kawasaki\\.jp|co\\.cr|miyagi\\.jp|org\\.jp|osaka\\.jp|web\\.za|net\\.za|gov\\.pk|gov\\.vn|agrar\\.hu|asn\\.lv|org\\.sv|net\\.sh|org\\.sa|org\\.dz|assedic\\.fr|com\\.sy|net\\.ph|mil\\.ge|es\\.tt|mobile\\.nr|co\\.kr|ltd\\.uk|ac\\.be|fgov\\.be|geek\\.nz|ind\\.gg|net\\.mt|maori\\.nz|ens\\.tn|edu\\.py|gov\\.sd|gov\\.qa|nt\\.ca|com\\.pg|org\\.kh|pc\\.pl|com\\.eg|net\\.ly|se\\.com|gb\\.com|edu\\.ar|sch\\.je|mil\\.ac|mil\\.ar|okayama\\.jp|gov\\.sg|ac\\.id|co\\.id|com\\.ly|huissier-justice\\.fr|nic\\.im|gov\\.lv|nu\\.ca|org\\.sg|com\\.kh|org\\.vi|sa\\.cr|lg\\.jp|ns\\.ca|edu\\.co|gov\\.im|edu\\.om|net\\.dz|org\\.pl|pp\\.ru|tm\\.mt|org\\.ar|co\\.gg|org\\.im|edu\\.qa|org\\.py|edu\\.uy|targi\\.pl|com\\.ge|gub\\.uy|gov\\.ar|ltd\\.gg|fr\\.tt|net\\.qa|com\\.np|ass\\.dz|se\\.tt|com\\.ai|org\\.ma|plo\\.ps|co\\.at|med\\.sa|net\\.sg|kanazawa\\.jp|com\\.fr|school\\.za|net\\.pl|ngo\\.za|net\\.sy|ed\\.jp|org\\.na|net\\.ma|asso\\.fr|police\\.uk|powiat\\.pl|govt\\.nz|sk\\.ca|tj\\.cn|mil\\.ec|com\\.jo|net\\.mo|notaires\\.fr|avoues\\.fr|aeroport\\.fr|yn\\.cn|gov\\.et|gov\\.sa|gov\\.ae|com\\.tt|art\\.dz|firm\\.ve|com\\.sd|school\\.nz|edu\\.et|gob\\.pa|telecom\\.na|ac\\.cy|gz\\.cn|net\\.kw|mobil\\.nr|nic\\.uk|co\\.th|com\\.vu|com\\.re|belgie\\.be|nl\\.ca|uk\\.com|com\\.om|utazas\\.hu|presse\\.fr|co\\.ck|xz\\.cn|org\\.tr|mil\\.co|edu\\.cn|net\\.ec|on\\.ca|konyvelo\\.hu|gop\\.pk|net\\.om|info\\.ve|com\\.ni|sa\\.com|com\\.tr|sch\\.sd|fukushima\\.jp|tel\\.nr|atm\\.pl|kitakyushu\\.jp|com\\.qa|firm\\.co|edu\\.tt|games\\.hu|mil\\.nz|cri\\.nz|net\\.az|org\\.ge|mie\\.jp|net\\.mx|sch\\.ae|nieruchomosci\\.pl|int\\.vn|edu\\.za|com\\.cy|wakayama\\.jp|gov\\.hk|org\\.pa|edu\\.au|gov\\.in|pro\\.om|2000\\.hu|szkola\\.pl|shimane\\.jp|co\\.zw|gove\\.tw|com\\.co|net\\.ck|net\\.pk|net\\.ve|org\\.ru|uk\\.net|org\\.co|uu\\.mt|com\\.cu|mil\\.za|plc\\.uk|lkd\\.co\\.im|gs\\.cn|sex\\.hu|net\\.je|kumamoto\\.jp|mil\\.lb|edu\\.yu|gov\\.ws|sendai\\.jp|eu\\.org|ah\\.cn|net\\.vn|gov\\.sb|net\\.pe|nagoya\\.jp|geometre-expert\\.fr|net\\.fk|biz\\.tt|org\\.sh|edu\\.sa|saga\\.jp|sx\\.cn|org\\.je|org\\.ye|muni\\.il|kochi\\.jp|com\\.bh|org\\.ec|priv\\.at|gov\\.sy|org\\.ni|casino\\.hu|res\\.in|uy\\.com)"

    // insert it
    res = tldRes[1] + tldStr + tldRes[3];
  }
  return new RegExp(res + "$", "i");
}

  
////////////////////////////////////////////////////////////////////////////////

GM_addStyle(
    "#ShortcutBinderGlobalDialog { "+
    "   color:black; background-color:white;"+
    "   position: fixed; top: 50px; left: 50%;"+
    "   border: 1px dashed black; margin: 0 0 0 -200px; padding: 5px;"+
    "   width: 400px; height: 100px;"+
    "   text-align: center;"+
    "   "+
    "}"+

    "#ShortcutBinderGlobalDialog input { "+
    "   margin: 2px 10px;"+
    "   wxidth: 100%;"+
    "   "+
    "   "+
    "}"+

    "#ShortcutBinderAddDialog { "+
    "   color:black; background-color:white;"+
    "   position: fixed;"+
    "   border: 1px solid gray; margin: 0; padding: 5px;"+
    "   width: 400px;"+
    "   text-align: left;"+
    "   "+
    "   "+
    "   "+
    "   "+
    "}"+
    "#ShortcutBinderAddDialog h2{ "+
    "   cursor: move;"+
    "}"+
    "#ShortcutBinderGlobalDialog h2, #ShortcutBinderAddDialog h2{ "+
    "   padding: 5px; margin: 0;"+
    "   color: white; background: gray;"+
    "   "+
    "}"+

    "#ShortcutBinderAddDialog label { "+
    "   display: block; margin: 5px;"+
    "   "+
    "   "+
    "   "+
    "}"+
    "#ShortcutBinderAddDialog input {"+
    "   "+
    "   width: 100%;"+
    "   "+
    "   "+
    "}"+
    "#ShortcutBinderAddDialog .suggestions { "+
    "   margin: 5px 5px 5px 15px;"+
    "   "+
    "   "+
    "   "+
    "}"+
    "#ShortcutBinderAddDialog textarea {"+
    "   width: 100%;"+
    "   height: 100px;"+
    "}"+
    
    ""
);
