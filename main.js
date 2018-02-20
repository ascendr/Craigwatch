var focused = true;

window.onfocus = function() {
    focused = true;
    location.reload();
};
window.onblur = function() {
    focused = false;
};

var bcomm = chrome.extension.connect({
      name: "Background Communication"
 });

 //"runnow"
 document.addEventListener('DOMContentLoaded', function() {
     var runnow = document.getElementById('runnow');
     runnow.addEventListener('click', function() {
       bcomm.postMessage({"message" : "runnow"})
       build_table();
     })
 })

 document.addEventListener('DOMContentLoaded', function() {
     var cc = document.getElementById('clearcache');
     cc.addEventListener('click', function() {
       bcomm.postMessage({"message" : "clearcache"})
       build_table();
     })
 })


document.addEventListener('DOMContentLoaded', function() {
    var pollinput = document.getElementById('pollmin');
    pollinput.addEventListener('change', function() {
      changePref({"polltime" : pollinput.value * 60 * 1000})
    })
})

document.addEventListener('DOMContentLoaded', function() {
    var chkaud = document.getElementById('chk_audible');
    chkaud.addEventListener('change', function() {
      changePref({"audible" : chkaud.checked})
    })
})

document.addEventListener('DOMContentLoaded', function() {
    var enablebutton = document.getElementById('button_enable');
    enablebutton.addEventListener('click', function() {
        if (enablebutton.value == 'enabled'){
          enablebutton.value = "disabled"
        } else {
          enablebutton.value = "enabled"
        }
        changePref({"srchstatus" : enablebutton.value})
    });
});

document.addEventListener('DOMContentLoaded', function() {
    var btnbulk = document.getElementById('btn_bulkack');
    btnbulk.addEventListener('click', function() {
      do_bulk_ack();
    })
})

document.addEventListener('DOMContentLoaded', function() {
    var sall = document.getElementById('ckb_sall');
    console.log(sall)
    if(sall){
      sall.addEventListener('change', function() {
        console.log(sall.checked)
        selectAll(sall.checked);
      })
    }
})


function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

function selectAll(state){
  ckbs = document.getElementsByClassName("result-ckb")
  for (i = 0; i < ckbs.length; i++){
    ckbs[i].checked = state
  }
}

function ack(pids,callback){
  if (typeof pids != "object") {
    // add it to array for processing
    pids = [pids]
  }
  chrome.storage.local.get({"rrows" : []}, function (stored) {
    var rrows = stored.rrows
    for (var i = 0 ; i<pids.length; i++) {
      for (var j = 0 ; j<rrows.length; j++){
        if ( rrows[j].pid == pids[i] ){
          console.log("pid " + pids[i] + " matched")
          console.log(j)
          rrows.splice(j, 1);
        }
      }
    }
    chrome.storage.local.set({ "rrows" : rrows }, function (result){
      callback(true)
    })
  })
}

function changePref(pobj){
  chrome.storage.local.get({"preferences" : {}} , function (stored) {
    cprefs = stored.preferences
    console.log("old prefs")
    console.log(cprefs)
    cprefs[Object.keys(pobj)] = pobj[Object.keys(pobj)]
    chrome.storage.local.set({ "preferences" : cprefs});
    bcomm.postMessage({"message" : "prefchange"})
    console.log("new prefs")
    console.log(cprefs)
  })
}

function do_rmsrch(btn){
  console.log(btn.target.id);
  chrome.storage.sync.get("syncd_searches", function (stored) {
    var srows = stored.syncd_searches
    for (i = 0 ; i<srows.length; i++){
      if ( srows[i].pid == btn.target.id ){
        srows.splice(i, 1);
      }
    }
    chrome.storage.sync.set({"syncd_searches" : srows});
  });
  load_stored_searches();
}

function do_bulk_ack(){
  console.log("bulk")
  ckids = []
  ckbs = document.getElementsByClassName("result-ckb")
  console.log(ckbs)
  for (i = 0; i < ckbs.length; i++){
    if (ckbs[i].checked) {
      ckids.push(ckbs[i].id)
    }
  }
  console.log(ckids)
  ack(ckids, function(){
    build_table();
  });
}

function do_ack(btn){
  console.log(btn.target.id)
  ack(btn.target.id , function(){
    build_table();
  })
}

function load_stored_searches(){
  chrome.storage.sync.get("syncd_searches" , function(stored) {
    console.log("saved_searches: " + stored.syncd_searches.length)
    console.log(stored.syncd_searches)
    var table = document.getElementById("search-table");
    table.innerHTML = "";
    var header = table.createTHead();
    hrow = header.insertRow(0)
    hrow.insertCell(0).innerHTML = "";
    hrow.insertCell(1).innerHTML = "<strong>Region</strong>";
    hrow.insertCell(2).innerHTML = "<strong>Category</strong>";
    hrow.insertCell(3).innerHTML = "<strong>Sub Category</strong>";
    hrow.insertCell(4).innerHTML = "<strong>Search Terms</strong>";
    var ss = stored.syncd_searches;
    document.getElementById("ss_badge").innerText = ss.length
    for (i = 0; i<ss.length; i++){
      var row = table.insertRow(-1)
      row.id = ss[i].pid
      row.setAttribute("data-toggle", "tooltip")
      row.setAttribute("title", decodeURIComponent(decodeURI(ss[i].search)))
      var button = document.createElement("button");
      button.innerHTML = "<span id=\"" + ss[i].pid + "\" class=\"glyphicon glyphicon-remove\"/>";
      button.id = ss[i].pid;
      button.addEventListener("click", do_rmsrch);
      row.insertCell(-1).appendChild(button);
      //row.insertCell(-1).innerHTML = decodeURI(ss[i].search)
      row.insertCell(-1).innerHTML = ss[i].area
      row.insertCell(-1).innerHTML = ss[i].cat
      row.insertCell(-1).innerHTML = ss[i].subcat
      row.insertCell(-1).innerHTML = ss[i].query
    }
  });
}
function build_table() {
  chrome.browserAction.setBadgeText({text: ""});
  chrome.tabs.getSelected(null, function(tab){
    var table = document.getElementById("result-table");
    for(var i = table.rows.length - 1; i > 0; i--) {
      table.deleteRow(i);
    }
    chrome.storage.local.get({"rrows" : []}, function (stored) {
      var rrows = stored.rrows
      chrome.storage.local.get({"pids" : []}, function (result) {
        var pids = result.pids;
        // mark as viewed to clear notifications
        pids.forEach( function (p){
            p.viewed = true;
        })
        document.getElementById("r_badge").innerText = rrows.length
        for (i = rrows.length -1;i>=0;i--){
          (function(i){
              var row = table.insertRow(-1);
              row.id = rrows[i].pid
              row.className = "table-data"
              var ckb = document.createElement("input")
              ckb.type = "checkbox"
              ckb.id = rrows[i].pid
              ckb.className = "result-ckb"
              row.insertCell(-1).appendChild(ckb);
              var button = document.createElement("button");
              button.innerHTML = "<span id=\"" + rrows[i].pid + "\" class=\"glyphicon glyphicon-ok\"/>";
              button.id = rrows[i].pid;
              button.addEventListener("click", do_ack);
              row.insertCell(-1).appendChild(button);
              a = document.createElement('a');
              a.appendChild(document.createTextNode(rrows[i].title))
              a.setAttribute("data-toggle","popover")
              a.setAttribute("data-trigger","focus")
              a.setAttribute("data-content", rrows[i].img)
              a.href = rrows[i].url
              row.insertCell(-1).appendChild(a)
              row.insertCell(-1).innerHTML = rrows[i].area;
              row.insertCell(-1).innerHTML = rrows[i].nearby;
              row.insertCell(-1).innerHTML = rrows[i].price;
          })(i)
        }
        chrome.storage.local.set({"rrows" : rrows});
        console.log(pids)
        chrome.storage.local.set({"pids" : pids} , function (result){
          if (chrome.runtime.lastError) {
            console.log(chrome.runtime.lastError.message)
          }
        });
      });
    });
  });
}

function get_prefs(){
  chrome.storage.local.get({"preferences" : {}} , function(stored) {
    var prefs = stored.preferences;
    if ( isEmpty(prefs) ) {
      prefs.polltime = 15 * 60 * 1000;
      prefs.srchstatus = "disabled";
      prefs.audible = false;
    }
    console.log(prefs)
    document.getElementById("pollmin").value = (prefs.polltime/1000/60)
    document.getElementById("button_enable").value = prefs.srchstatus
    document.getElementById("chk_audible").checked = prefs.audible
  })
}

get_prefs();
load_stored_searches();
build_table();
