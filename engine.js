/* Copyright 2011, see LICENSE for details */

jsMiner.engine = function(options){
  this.publisherId = "";
  this.siteId = "";
  this.delayBetweenNonce = 30;
  this.sha = new Sha256();
  this.hashRate = 0;
  this.workerRunning = false;
  this.forceUIThread = false;
  this.autoStart = true;
  this.workerTimeout = 90;

  if(options){
    if (options.hasOwnProperty("clientId"))
      this.clientId = options.clientId;
    if (options.hasOwnProperty("siteId"))
      this.siteId = options.siteId;
    if (options.hasOwnProperty("delay"))
      this.delayBetweenNonce = options.delay;
    if (options.hasOwnProperty("forceUIThread"))
      this.forceUIThread = options.forceUIThread;
    if (options.hasOwnProperty("autoStart"))
      this.autoStart = options.autoStart;
    if (options.hasOwnProperty("workerTimeout"))
      this.workerTimeout = options.workerTimeout;
  }

  this.loadMoreWork = function(result){
    var url = "/work?client_id=" + this.clientId;
    if(this.siteId != ""){
	  url = url + "&site_id=" + this.siteId;
    }
    if(this.hashRate > 0){
      url = url + "&hash_rate=" + this.hashRate + "&hash_count=" + (this.hashRate * this.workerTimeout);
    }
    var me = this;
    var httpRequest;
    if(window.XDomainRequest){ //IE8+
      httpRequest = new XDomainRequest();
      httpRequest.onload = function(response){
        me.handleGetWorkResponse(httpRequest.responseText);
      };
    }else if (window.XMLHttpRequest) { // Everybody else
      httpRequest = new XMLHttpRequest();
      httpRequest.onreadystatechange = function(response){
        try{
          if(httpRequest.readyState == 4){
            if(httpRequest.status == 200){
              me.handleGetWorkResponse(httpRequest.responseText);
            }else{
              setTimeout(3000, function(){ loadMoreWork(result) });
            }
          }
        }catch(e){
          setTimeout(3000, function(){ loadMoreWork(result) });
        }
      };
    } else { /* you're fucked! */}

    if(!httpRequest)
      return;

    if(!result){
      httpRequest.open('GET', url);
      httpRequest.send();
    }else{
      httpRequest.open('POST', url);
      httpRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      httpRequest.send(jsMiner.Util.toPoolString(result));
    }
  };

  this.handleGetWorkResponse = function(response){
    var work = eval("(" + response + ")");
    var midstate = jsMiner.Util.fromPoolString(work.midstate);
    var half = work.data.substring(0, 128);
    var data = work.data.substring(128, 256);
    data = jsMiner.Util.fromPoolString(data);
    half = jsMiner.Util.fromPoolString(half);
    var hash1 = jsMiner.Util.fromPoolString(work.hash1);
    var target = jsMiner.Util.fromPoolString(work.target);

    this.workerEntry(midstate, half, data, hash1, target, work.first_nonce, work.last_nonce);
  };

  this.webWorkerEntry = function(midstate, half, data, hash1, target, startNonce, endNonce){
    var me = this;
    var startTime = (new Date()).getTime() ;
    if(!this.webWorker){
      this.webWorker = new Worker('jsMiner.js');
    }
    this.webWorker.onmessage = function(event) {
      var stopTime = (new Date()).getTime() ;
      me.workerRunning = false;
      me.hashRate = (event.data.lastNonce - startNonce) / (stopTime - startTime) * 1000;
      me.loadMoreWork(event.data.data);
    };
    this.webWorker.postMessage({
      midstate: midstate,
      half: half,
      data: data,
      hash1: hash1,
      target: target,
      startNonce: startNonce,
      endNonce: endNonce,
      pubId: this.publisherId,
      timeout: this.workerTimeout
    });
  };

  this.workerEntry = function(midstate, half, data, hash1, target, startNonce, endNonce){
    if(!!window.Worker && !this.forceUIThread){
      this.webWorkerEntry(midstate, half, data, hash1, target, startNonce, endNonce);
      return;
    }
    var nonce = startNonce;
    var delay = this.delayBetweenNonce;
    var me = this;
    var startTime = (new Date()).getTime() ;
    var endTime = startTime + this.workerTimeout * 1000;
    this.workerRunning = true;

    var workerDone = function(result){
      var stopTime = (new Date()).getTime() ;
      me.workerRunning = false;
      me.hashRate = (nonce - startNonce) / (stopTime - startTime) * 1000;
      me.loadMoreWork(result);
    };

    function worker(){

      for(var i = 0; i != 100 && nonce < endNonce; i++){
        var hash =  me.tryHash(midstate, half, data, hash1, target, nonce);
        if(hash != null){
          workerDone(hash);
          return;
        }
        nonce++;
      }
      if(nonce++ < endNonce && (new Date()).getTime()  <= endTime)
        setTimeout(worker, delay);
      else
        workerDone(null);
    };
    setTimeout(worker, delay);
  };

  this.tryHash = function(midstate, half, data, hash1, target, nonce){
    data[3] = nonce;
    this.sha.reset();

    var h0 = this.sha.update(midstate, data).state;   // compute first hash
    for (var i = 0; i < 8; i++) hash1[i] = h0[i];   // place it in the h1 holder
    this.sha.reset();                 // reset to initial state
    var h = this.sha.update(hash1).state;       // compute final hash
    if (h[7] == 0) {
      var ret = [];
      for (var i = 0; i < half.length; i++)
        ret.push(half[i]);
      for (var i = 0; i < data.length; i++)
        ret.push(data[i]);
      return ret;
    } else return null;
  };

  //bootstrap
  if(this.autoStart)
    this.loadMoreWork();
}

if (typeof window  == "undefined"){
  //then the code is running in a web worker.
  self.onmessage = function(event) {
    var startTime = (new Date()).getTime() ;
    var endTime = startTime + event.data.timeout * 1000;
    var engine = new jsMiner.engine({pubId: event.data.pubId, autoStart: false});
    for(var nonce = event.data.startNonce; nonce != event.data.endNonce; nonce++){
      var result = engine.tryHash(event.data.midstate, event.data.half, event.data.data, event.data.hash1, event.data.target, nonce);
      if(result){
        postMessage({data: result, lastNonce: nonce});
        return;
      }else if(nonce % 100 && (new Date()).getTime()  >= endTime){
        postMessage({data: null, lastNonce: nonce});
        return;
      }
    }
    postMessage({data: null, lastNonce: event.data.endNonce});
  };
}
