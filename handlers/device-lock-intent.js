/* jshint node: true */
"use strict";

var async = require('asyncawait/async');
var await = require('asyncawait/await');
var RampiotClient = require("./../service/rampiot-client").RampiotClient;
var CommonSlotsHandler = require("./common-slots-handler");
var RampiotDeviceFactory = require("./../rampiot-devices/rampiot-device-factory");
var Utils = require("./../utils/utils");
var Logger = Utils.Logger;
var MQTTClient = require("./../mqtt/mqtt-client");

/*Slots Name*/
var DEVICE_NAME = "deviceName";

exports.Handler = async(function(ctx){
    var updatedIntent = ctx.event.request.intent;
    var slots = updatedIntent.slots;
    await( CommonSlotsHandler.Handler(ctx) );
    if (ctx.event.request.dialogState === 'STARTED') {
        ctx.emit(':delegate', updatedIntent);
    }
    else if(ctx.event.request.dialogState === 'COMPLETED'){
        try{            
            if( ctx.attributes.thing.status.event === "lock" ){
                ctx.emit(':tell', ctx.t("DEVICE_ALREADY_LOCKED").replace("{deviceName}", slots[DEVICE_NAME].value));
                ctx.emit(":responseReady");
                return;
            }
            var thing = ctx.attributes.thing;
            var directive = Utils.callDirectiveService(
                ctx.event,
                ctx.t("LOCKING_DEVICE").replace("{deviceName}", slots[DEVICE_NAME].value)
            )
            .catch(function(error){
                Logger.logError(error);
                ctx.emit(':tellWithCard', ctx.t("GENERAL_ERROR_LOCK"), ctx.t("ERROR"), ctx.t("GENERAL_ERROR_LOCK"));
                ctx.emit(":responseReady");
            });
            MQTTClient.subscribe(
                Utils.getTopicForEventSubscribe(ctx.attributes.thing._id), 
                ctx.attributes.accessToken,
                function(error, message){
                    if( error ){
                        Logger.logDebug(error);                                    
                    }
                    Logger.logDebug(JSON.stringify(message));
                    /* Device report lock event then response OK */
                    if( message && message.status && message.status.event === "lock" ){
                        ctx.emit(':tell', ctx.t("DEVICE_LOCKED").replace("{deviceName}", slots[DEVICE_NAME].value));
                        ctx.emit(":responseReady");
                    }
                    else{
                        /* Device can't lock, then response with error */
                        ctx.emit(':tell', ctx.t("CANT_UNLOCK").replace("{deviceName}",slots[DEVICE_NAME].value));
                        ctx.emit(":responseReady");
                    }
            }, async(function(){
                try{
                    var rampiotClient = new RampiotClient();  
                    var thingType = ctx.attributes.thing.type._id;
                    Logger.logDebug("Device type: "+thingType);
                    var deviceInfo = RampiotDeviceFactory.getRampiotDeviceInfo(thingType);                        
                    var resp = await(rampiotClient.sendCommand(
                        ctx.attributes.accessToken, 
                        ctx.attributes.thing._id, 
                        deviceInfo.parseEvent("lock")
                    ));
                }catch(exc){
                    Logger.logError(exc);
                    /** Already on requested status */
                    if( exc && exc.code && exc.code === 1057 ){
                        ctx.emit(':tell', Utils.getRandomArrayItem(ctx.t("DEVICE_LOCKED")).replace("{deviceName}", slots[DEVICE_NAME].value));
                        ctx.emit(":responseReady");
                    }else{
                        ctx.emit(':tellWithCard', ctx.t("GENERAL_ERROR"), ctx.t("ERROR"), ctx.t("GENERAL_ERROR"));
                        ctx.emit(":responseReady");
                    }        
                }
            }));            
        }catch(exc){
            Logger.logError(exc);            
            ctx.emit(':tellWithCard', ctx.t("GENERAL_ERROR"), ctx.t("ERROR"), ctx.t("GENERAL_ERROR"));
            ctx.emit(":responseReady");            
        }
    }
    else{
        ctx.emit(':delegate', updatedIntent);
    }
});