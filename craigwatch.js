if (document.getElementsByClassName("querybox").length > 0){
  el = document.getElementsByClassName("global-header")[0]
  var btncw = document.createElement("button");
  btncw.innerText = "craigwatch"
  el.appendChild(btncw);
} 

btncw.addEventListener ("click", function() {
  craigwatch() 
});

function craigwatch(){
  console.log("clicked")
  xsearch = document.getElementsByClassName("saveme")[0].search;
  stri = "URL%3D"
  search = xsearch.substring(xsearch.indexOf(stri) + stri.length)
  query = document.getElementById("query").value
  e = document.getElementById("subcatAbb")
  subcat = e.options[e.selectedIndex].text
  e = document.getElementById("catAbb")
  cat = e.options[e.selectedIndex].text
  e = document.getElementById("areaAbb")
  area = e.options[0].text
  searchobj = { "pid" : (new Date).getTime(), "area" : area , "cat" : cat , "subcat" : subcat , "query" : query , "search" : search }  
  console.log(searchobj);
  chrome.runtime.sendMessage({"searchobj": searchobj},
    function(response) {
      //if (!response.success)
        console.log("craigwatch added");
    }
  );
}
