/* Copyright 2011, see LICENSE for details */

if (typeof(jsMiner) == 'undefined')
  var jsMiner = {};

jsMiner.Util = {
  hex_to_uint32_array: function(hex) {
    var arr = [];
    for (var i = 0, l = hex.length; i < l; i += 8) {
      arr.push(parseInt(hex.substring(i, i+8), 16));
    }
    return arr;
  },
  
  uint32_array_to_hex: function(arr) {
    var hex = '';
    for (var i = 0; i < arr.length; i++) {
      hex += jsMiner.Util.byte_to_hex(arr[i] >>> 24);
      hex += jsMiner.Util.byte_to_hex(arr[i] >>> 16);
      hex += jsMiner.Util.byte_to_hex(arr[i] >>>  8);
      hex += jsMiner.Util.byte_to_hex(arr[i]       );
    }
    return hex;
  },
  
  byte_to_hex: function(b) {
    var tab = '0123456789abcdef';
    b = b & 0xff;
    return tab.charAt(b / 16) +
           tab.charAt(b % 16);
  },

  reverseBytesInWord: function(w) {
    return ((w <<  24) & 0xff000000) |
           ((w <<   8) & 0x00ff0000) |
           ((w >>>  8) & 0x0000ff00) |
           ((w >>> 24) & 0x000000ff);
  },
  
  reverseBytesInWords: function(words) {
    var reversed = [];
    for(var i = 0; i < words.length; i++)
      reversed.push(jsMiner.Util.reverseBytesInWord(words[i]));
    return reversed;
  },

  fromPoolString: function(hex) {
    return jsMiner.Util.reverseBytesInWords(jsMiner.Util.hex_to_uint32_array(hex));
  },
  
  toPoolString: function(data) {
    return jsMiner.Util.uint32_array_to_hex(jsMiner.Util.reverseBytesInWords(data));
  }
};

var module;
module = module || {};
module.exports = jsMiner.Util;