/* Copyright 2011, see LICENSE for details */

jsMiner.engine = function(options){
  this.publisherId = "";
  this.siteId = "";
  this.delayBetweenNonce = 30;
  this.hashRate = 0;
  this.workerRunning = false;
  this.forceUIThread = false;
  this.autoStart = true;
  this.workerTimeout = 30;

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
    var url = "http://api.bitp.it/work?client_id=" + this.clientId;
    if(this.siteId != ""){
	  url = url + "&site_id=" + this.siteId;
    }
    if(this.hashRate > 0){
      url = url + "&hash_rate=" + this.hashRate + "&hash_count=" + (this.hashRate * 1000 * this.workerTimeout);
    }
    var me = this;
    var httpRequest;
    if(window.XDomainRequest){ //IE8+
      httpRequest = new XDomainRequest();
      httpRequest.onload = function(response){
        if (!result) me.handleGetWorkResponse(httpRequest.responseText);
      };
    }else if (window.XMLHttpRequest) { // Everybody else
      httpRequest = new XMLHttpRequest();
      httpRequest.onreadystatechange = function(response){
        try{
          if(httpRequest.readyState == 4){
            if(httpRequest.status == 200){
              if (!result) me.handleGetWorkResponse(httpRequest.responseText);
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

      var last = Math.min(nonce + 1024, endNonce + 1);
      var data_ = half.concat(data);
      me.tryHash(midstate, data_, nonce, last, function(lastnonce)
      {
        nonce = lastnonce;
        data[19] = nonce;
        workerDone(data)
      });
      nonce = last - 1;
      if(nonce++ < endNonce && (new Date()).getTime()  <= endTime)
        setTimeout(worker, delay);
      else
        workerDone(null);
    };
    setTimeout(worker, delay);
  };

  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
           0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
           0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
           0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
           0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
           0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
           0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
           0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];

  var os0 = 0x6a09e667, os1 = 0xbb67ae85, os2 = 0x3c6ef372, os3 = 0xa54ff53a;
  var os4 = 0x510e527f, os5 = 0x9b05688c, os6 = 0x1f83d9ab, os7 = 0x5be0cd19;

  this.tryHash = function(is, iw, firstnonce, lastnonce, callback)
  {
    var w0 = 0, w1 = 0, w2 = 0, w3 = 0, w4 = 0, w5 = 0, w6 = 0, w7 = 0;
    var w8 = 0, w9 = 0, w10 = 0, w11 = 0, w12 = 0, w13 = 0, w14 = 0, w15 = 0;
    var s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, s5 = 0, s6 = 0, s7 = 0;
    var is0 = is[0], is1 = is[1], is2 = is[2], is3 = is[3];
    var is4 = is[4], is5 = is[5], is6 = is[6], is7 = is[7];
    var iw0 = iw[16], iw1 = iw[17], iw2 = iw[18];
    var i = 0, j = 0, t0 = 0, t1 = 0, e = 0;
    for (var nonce = firstnonce; nonce < lastnonce; nonce++)
    {
      w0 = iw0;
      w1 = iw1;
      w2 = iw2;
      w3 = nonce;
      w4 = 0x80000000;
      w5 = 0;
      w6 = 0;
      w7 = 0;
      w8 = 0;
      w9 = 0;
      w10 = 0;
      w11 = 0;
      w12 = 0;
      w13 = 0;
      w14 = 0;
      w15 = 0x280;
      s0 = is0;
      s1 = is1;
      s2 = is2;
      s3 = is3;
      s4 = is4;
      s5 = is5;
      s6 = is6;
      s7 = is7;
      for (i = 0; i < 125; i++)
      {
        if (i == 64)
        {
          w0 = is0 + s0;
          w1 = is1 + s1;
          w2 = is2 + s2;
          w3 = is3 + s3;
          w4 = is4 + s4;
          w5 = is5 + s5;
          w6 = is6 + s6;
          w7 = is7 + s7;
          w8 = 0x80000000;
          w9 = 0;
          w10 = 0;
          w11 = 0;
          w12 = 0;
          w13 = 0;
          w14 = 0;
          w15 = 0x100;
          s0 = os0;
          s1 = os1;
          s2 = os2;
          s3 = os3;
          s4 = os4;
          s5 = os5;
          s6 = os6;
          s7 = os7;
        }
        e = (((s0 << 30) | (s0 >>> 2))
           ^ ((s0 << 19) | (s0 >>> 13))
           ^ ((s0 << 10) | (s0 >>> 22)))
          + ((s0 & s1) | (s2 & (s0 | s1)));
        t0 = (((((w1 << 25) ^ (w1 << 14))
              & 0xe0000000)
             | ((((w1 << 25) | (w1 >>> 7))
               ^ ((w1 << 14) | (w1 >>> 18))
               ^ (w1 >>> 3))
              & 0x1fffffff))
            + ((((w14 << 15) ^ (w14 << 13))
              & 0xffc00000)
             | ((((w14 << 15) | (w14 >>> 17))
               ^ ((w14 << 13) | (w14 >>> 19))
               ^ (w14 >>> 10))
              & 0x003fffff))
            + w0
            + w9)
           & 0xffffffff;
        t1 = K[i & 0x3f]
           + w0
           + s7
           + (((s4 << 26) | (s4 >>> 6))
            ^ ((s4 << 21) | (s4 >>> 11))
            ^ ((s4 << 7) | (s4 >>> 25)))
           + (s6 ^ (s4 & (s5 ^ s6)));
        w0 = w1;
        w1 = w2;
        w2 = w3;
        w3 = w4;
        w4 = w5;
        w5 = w6;
        w6 = w7;
        w7 = w8;
        w8 = w9;
        w9 = w10;
        w10 = w11;
        w11 = w12;
        w12 = w13;
        w13 = w14;
        w14 = w15;
        w15 = t0;
        s7 = s6;
        s6 = s5;
        s5 = s4;
        s4 = (s3 + t1) & 0xffffffff;
        s3 = s2;
        s2 = s1;
        s1 = s0;
        s0 = (e + t1) & 0xffffffff;
      }
      if (((os7 + s4) & 0xffffffff) == 0) callback(nonce);
    }
    return false;
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
    for(var nonce = event.data.startNonce; nonce <= event.data.endNonce; nonce += 65536){
      var last = Math.min(nonce + 65536, event.data.endNonce + 1);
      var data = event.data.half.concat(event.data.data);
      engine.tryHash(event.data.midstate, data, nonce, last, function(lastnonce)
      {
        data[19] = lastnonce;
        postMessage({data: data, lastNonce: lastnonce});
      });
      if((new Date()).getTime()  >= endTime){
        postMessage({data: null, lastNonce: last - 1});
        return;
      }
    }
    postMessage({data: null, lastNonce: event.data.endNonce});
  };
}
