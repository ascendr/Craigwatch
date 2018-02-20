var runstate;
var srchTimer;
var audalert;
var locked = 0;
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
      chrome.storage.sync.get({"syncd_searches": [] }, function(storage) {
        var stored_searches = storage.syncd_searches;
        stored_searches.push(request.searchobj);
        chrome.storage.sync.set({"syncd_searches" : stored_searches}, function(result){
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

function cleanup(pids,srows){
  // count new and alert
    console.log("cleanup::pids: " + pids.length)
    console.log(pids)
    var count = 0;
    for (i = 0; i < pids.length; i++){
      //console.log(pids[i])
      if (pids[i] != undefined){
        daysago30 = new Date().setDate(new Date().getDate()-30)
        if (pids[i].ls < daysago30){
          console.log(pids[i] + " is > 30d ago")
          pids.splice(i, 1);
        }
      }
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
    chrome.storage.local.set({"pids" : pids });
    chrome.storage.local.set({"rrows" : srows });
}

function xhtquery(url){
  return new Promise(function (resolve, reject) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        var content_type = xhttp.getResponseHeader("Content-Type")
        var content = xhttp.response
        resolve({"result" : content})
      }
    }
    xhttp.onerror = function () {
      reject({ "error": xhttp.statusText});
    }
    //url = decodeURIComponent(decodeURI(stored_searches[s].search))
    console.log("running query: " + url)
    xhttp.open("GET", url , true);
    xhttp.responseType = "document";
    //xhttp.overrideMimeType('text/xml');
    xhttp.send();
  })
}

function doeach(searches,pids,srows){
  console.log("doeach::pids " + pids.length)
return new Promise( function (resolve, reject) {
    var p = Promise.all(searches.map( function (s){
        return new Promise( function (resolve, reject) {
          stall(2000)
          url = decodeURIComponent(decodeURI(s.search))
          xhtquery(url).then( function (p1) {
            check_new(p1.result, pids , srows).then( function(p2){
              pids = p2.pids
              srows = p2.srows
              resolve();
            })
          })
        })
      }))
    p.then( function (){
      resolve({"pids" : pids , "srows" : srows})
    })
  })
}

function do_search(){
  if (runstate == "enabled"){
   var search_results = []
   console.log("Query Time: " + Date())
   chrome.storage.sync.get({"syncd_searches": [] }, function(storage) {
      var stored_searches = storage.syncd_searches;
      if ( isEmpty(stored_searches) ) {
       console.log("no stored searches to run");
       return;
      }
      var pids = []
      var srows = []
      getStored(function (stored){
        pids = stored.pids
        console.log("storedpids")
        console.log(pids.length)
        srows = stored.srows
        doeach(stored_searches,pids,srows).then( function (p1){
          cleanup(p1.pids, p1.srows);
        })
      })
   })
 }
}

function getStored(callback){
    chrome.storage.local.get({"pids" : []}, function (stored_pids){
      console.log("getStored::pids")
      console.log(stored_pids.pids)
      chrome.storage.local.get({"rrows" : []}, function(stored_rrows){
        callback({"pids" : stored_pids.pids , "srows" : stored_rrows.rrows})
      })
    })
}


function check_new(doc, pids , srows){
  return new Promise(function (resolve, reject) {
    console.log("check_new recieved " + pids.length + " pids")
    var new_rows = [];
    var subAopts = [];
    if (doc.length == 0) { resolve({"pids" : pids , "srows" : srows}) }
    if ( doc.getElementsByClassName("crumb subarea").length > 0 ){
      subAopts = doc.getElementById("subArea").getElementsByTagName("option")
    }
    var rrows = doc.getElementsByClassName("result-row")
    console.log(rrows.length + " result-rows returned from search")
    for (var i = 0; i<rrows.length; i++){
        (function(i){
          // use data-pid attribute UNLESS we have data-repost-of
          if ( rrows[i].getAttribute("data-repost-of") != null ){
            rpid = rrows[i].getAttribute("data-repost-of")
          } else {
            rpid = rrows[i].getAttribute("data-pid")
          }
          var found = false;
          for (var n = 0; n<pids.length;  ) {
            //console.log(pids[n].pid + " <?> " + rpid)
            if ( pids[n].pid == rpid){
              found = true
              console.log("matched!!!")
              pids[n].ls = Date.now()
              break;
            }
            n++
          }
          if (found == false){
            // new result
              console.log("didn't see: " + rpid)
              pids.push( new Object({"pid" : rpid, "viewed" : false, "ls" : Date.now() }))
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
   console.log("new rows from this search: " + new_rows.length)
   console.log(new_rows)
   var rowsadded = 0;
   if ( new_rows.length > 0){
     for (var i = 0 ; i < new_rows.length ; i++){
       shared = false
       for ( var j = 0 ; j < srows.length ; j++){
         if (new_rows[i].pid == srows[j].pid){
           shared = true;
           break;
         }
       }
       if ( shared == false){
         srows.push(new_rows[i]);
         rowsadded++;
       }
     }
     console.log("Appended " + rowsadded + " rows to rrows")
     resolve({"pids" : pids , "srows" : srows})
   } else {
     // no new result rows to add
     resolve({"pids" : pids , "srows" : srows})
   }
 })
}
