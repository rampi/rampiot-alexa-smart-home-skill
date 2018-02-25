/* jshint node: true */
"use strict";

var Alexa = require("alexa-sdk");
var config = require("./../config/configuration.json");
var jsonHash = require('json-hash');
var ALEXA_COMPATIBLE_RAMPIOT_TYPES = config.ALEXA_COMPATIBLE_RAMPIOT_TYPES;

exports.TIME_RELATED_UTTERANCES = {
    "EV": {
        start: {
            hours: 17,
            minutes: 0,
            formatted: "17:00"
        },
        end: {
            hours: 21,
            minutes: 0,
            formatted: "21:00"
        }
    },
    "NI": {
        start: {
            hours: 21,
            minutes: 0,
            formatted: "21:00"
        },
        end: {
            hours: 4,
            minutes: 59,
            formatted: "04:59"
        }
    },
    "MO": {
        start: {
            hours: 5,
            minutes: 0,
            formatted: "05:00"
        },
        end: {
            hours: 12,
            minutes: 0,
            formatted: "12:00"
        }
    },
    "AF": {
        start: {
            hours: 12,
            minutes: 0,
            formatted: "12:00"
        },
        end: {
            hours: 17,
            minutes: 0,
            formatted: "17:00"
        }
    }
};

exports.join = function(status, protectedStatus){
    var temp = {};
    Object.keys(status).forEach(function(k){
        if( protectedStatus.hasOwnProperty(k) ){
            temp[k] = status[k];
        }
    });
    return temp;
};

exports.getObjectHash = function(obj){
	return jsonHash.digest(obj);
};

exports.callDirectiveService = function(event, directiveMessage){
    var ds = new Alexa.services.DirectiveService();
    var requestId = event.request.requestId;
    var endpoint = event.context.System.apiEndpoint;
	var token = event.context.System.apiAccessToken;
	var directive = new Alexa.directives.VoicePlayerSpeakDirective(
        requestId, 
        directiveMessage
    );
    return ds.enqueue(directive, endpoint, token);
};

exports.dotNotate = function(obj,target,prefix) {
    target = target || {};
    prefix = prefix || "";  
    Object.keys(obj).forEach(function(key) {
      if ( typeof(obj[key]) === "object" ) {
        exports.dotNotate(obj[key],target,prefix + key + ".");
      } else {
        return target[prefix + key] = obj[key];
      }
    });
    return target;
};

exports.isRampiotDeviceAlexaCompatible = function(thingType){
    return ALEXA_COMPATIBLE_RAMPIOT_TYPES.indexOf(thingType) >= 0;
};

exports.getRandomArrayItem = function(array){
    return array[parseInt(Math.random()*array.length)];
};

exports.containsValue = function(array, value){
    return array.indexOf(value) >= 0;
};

exports.durationJSONToWords = function(durationJSON){
    var formatted = 
    (durationJSON.hours > 0 ? durationJSON.hours + (durationJSON.hours > 1 ? " hours," : " hour,") : "") +
    (durationJSON.minutes > 0 ? durationJSON.minutes + (durationJSON.minutes > 1 ? " minutes," : " minute,") : "") +
    (durationJSON.seconds > 0 ? durationJSON.seconds + (durationJSON.seconds > 1 ? " seconds," : " second,") : "");
    formatted = formatted.substr(0, formatted.length-1).trim();
    return formatted;
};

exports.Logger = {
    logDebug: function(msg){
        console.log(msg);
    },
    logError: function(err){
        console.error(err);
    }
};

exports.getTopicForEventSubscribe = function(endpointId){
    return "rampiot/"+endpointId+"/event";
};