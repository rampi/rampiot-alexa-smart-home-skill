/* jshint node: true */
"use strict";

var config = require("./../config/configuration.json");
var ALEXA_COMPATIBLE_RAMPIOT_TYPES = config.ALEXA_COMPATIBLE_RAMPIOT_TYPES;

/**
 * Gets device info by type
 */
exports.getRampiotDeviceInfo = function(thingType){
    if( ALEXA_COMPATIBLE_RAMPIOT_TYPES.indexOf(thingType) >= 0 ){
        return require("./"+thingType);
    }
    return null;
};