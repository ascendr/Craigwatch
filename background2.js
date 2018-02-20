var runstate;
var srchTimer;
var audalert;
get_prefs();

function stall( sleepDuration ){
    var now = new Date().getTime();
    while(new Date().getTime() < now + sleepDuration){ /* do nothing */ }
}

chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.create({'url': chrome.extension.getURL('main.html'), 'selected': true});
});

//messages from craigwatch.js (content script)
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
      chrome.storage.local.get({"saved_searches": [] }, function(storage) {
        var stored_searches = storage.saved_searches;
        stored_searches.push(request.searchobj);
        chrome.storage.local.set({"saved_searches" : stored_searches}, function(result){
           sendResponse({"success" : 1});
        });
      });
  });
// messages from main.js
chrome.extension.onConnect.addListener(function(frommain) {
      frommain.onMessage.addListener(function(main) {
           if ( main.message == "prefchange") {
             get_prefs();
           }
           if (main.message == "runnow"){
             temprs = runstate;
             runstate = "enabled"
             do_search();
             runstate = temprs
           }
           if(main.message == "clearcache"){
             clear_cache();
           }
      });
 });

function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

function merge(a , b , attr){
  c = []
  for(var i in a){
     var shared = false;
     for (var j in b)
         if (b[j].attr == a[i].attr) {
             shared = true;
             break;
         }
     if(!shared) c.push(a[i])
  }
  return c = c.concat(b)
}

function clear_cache(){
  chrome.storage.local.set({"pids" : [] });
  chrome.storage.local.set({"datapids" : [] });
  chrome.storage.local.set({"rrows" : [] });
}

function get_prefs(){
  chrome.storage.local.get({"preferences" : {}} , function(stored) {
    var prefs = stored.preferences;
    clearInterval(srchTimer)
    srchTimer = setInterval(do_search,prefs.polltime)
    runstate = prefs.srchstatus
    audalert = prefs.audible
    if (runstate == "enabled"){
      chrome.browserAction.setIcon({path: { "128" : "128activeeye.png"}})
    } else {
      chrome.browserAction.setIcon({path: { "128" : "128inactiveeye.png"}})
    }
  })
}

function cleanup(){
  // count new and alert
  chrome.storage.local.get({"pids" : [] } , function(pstore) {
    var pids = pstore.pids
    console.log("cleanup pids: " + pids.length)

    var count = 0;
    for (i = 0; i < pids.length; i++){
      console.log(pids[i])
      if (pids[i].viewed == false) {
        count++;
      }
    }
    console.log("cleanup count: " + count)
    if (count > 0) {
      chrome.browserAction.setBadgeText({text: count.toString()});
      if ( audalert == true ){
        var myAudio = new Audio();
        myAudio.src = "newmsg.mp3";
        myAudio.play();
      }
    }
  })
}

function do_search(){
  if (runstate == "enabled"){
    var search_results = []
    console.log("Query Time: " + Date())
    chrome.storage.local.get({"saved_searches": [] }, function(storage) {
        var stored_searches = storage.saved_searches;
        if ( isEmpty(stored_searches) ) {
         console.log("no stored searches to run");
         return;
        }

        var searches_run = 0
        for ( s = 0 ; s < stored_searches.length ; s++ ){
          stall(5000)
          var xhttp = new XMLHttpRequest();
          xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
              searches_run++;
              var content_type = xhttp.getResponseHeader("Content-Type")
              var content = xhttp.response

              console.log(content_type);
              console.log(content)
              if (content_type !== null && content !== null ){
                search_results.push(content)
              }
              if (searches_run == stored_searches.length){
                console.log("stored: " + search_results.length)
                search_results.forEach( function(obj){
                  check_new(obj, function(result){
                    console.log(result.message)
                  })
                })
                cleanup();
              }
            }
          }
          url = decodeURIComponent(decodeURI(stored_searches[s].search))
          console.log("running query: " + url)
          xhttp.open("GET", url , true);
          xhttp.responseType = "document";
          //xhttp.overrideMimeType('text/xml');
          xhttp.send();
        }
    })
  }
}


function check_new(doc){
  console.log(doc)
  //parser = new DOMParser();
  //doc = parser.parseFromString(htmlString, "text/html");
  var new_rows = [];
  var subAopts = [];
  if (doc.length == 0) { return }
  if ( doc.getElementsByClassName("crumb subarea").length > 0 ){
    subAopts = doc.getElementById("subArea").getElementsByTagName("option")
  }
  var rrows = doc.getElementsByClassName("result-row");
  var datapids = []
  chrome.storage.local.get({"pids" : []}, function (result) {
    var pids = result.pids;
    console.log("pids pulled from storage: " + pids.length)
    console.log(pids)
    for (i = 0;i<rrows.length;i++){
        (function(i){
          found = false
          rpid = rrows[i].getAttribute("data-pid")
          for (n = 0; n<pids.length; n++) {
            if ( pids[n].pid == rpid){
              found = true
            }
          }
          if (found == false){
            // new result
              pids.push( new Object({"pid" : rpid, "viewed" : false}))
              // Build srow object
              var obj = {"pid" : rpid}
              obj.area = false;
              obj.url = rrows[i].getElementsByClassName("result-title hdrlnk")[0].href
              if (subAopts.length > 0){
                // we have sub areas for this search so try it
                stri = ".org/"
                ss1 = obj.url.substring(obj.url.indexOf(stri) + stri.length)
                subAbrv = ss1.substring(ss1.indexOf("/") , 0)
                for (x = 0; x<subAopts.length; x++) {
                  if (subAbrv == subAopts[x].value) {
                    obj.area = subAopts[x].text
                  }
                }
              }
              if (obj.area == false){
                // no subarea found
                h = rrows[i].getElementsByClassName("result-title hdrlnk")[0].host
                obj.area = h.substring(h.indexOf('.'),0)
              }
              obj.title = rrows[i].getElementsByClassName("result-title hdrlnk")[0].innerText;
              el = rrows[i].getElementsByClassName("nearby")
              if (el.length > 0){
                obj.nearby = el[0].innerText;
              } else {
                obj.nearby = false;
              }
              el = rrows[i].getElementsByClassName("result-price");
              if (el.length > 0 ){
                obj.price = el[0].innerText;
              } else {
                obj.price = "$-";
              }
            new_rows.push(obj);
          }
        })(i)
    }
    chrome.storage.local.set({"pids" : pids} , function(result_pidstore){
      console.log("stored pids")
      var myError = chrome.runtime.lastError
      console.log(pids)
    })

    chrome.storage.local.get({"rrows" : []}, function(storage){
       var rrows = storage.rrows
       console.log("new rows from this search: " + new_rows.length)
       var newrrows = merge(new_rows,rrows,"pid")
       console.log(newrrows)
       chrome.storage.local.set({"rrows" : newrrows})
       //callback({"message": "success"});
    });
 });
}
