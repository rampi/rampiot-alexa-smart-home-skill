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
var UNLOCK_TIMEOUT = 4000;

/*Slots Name*/
var DEVICE_NAME = "deviceName";
var PIN = "pin";
var PIN_UNLOCK_MAX_ATTEMPS = 2;

exports.Handler = async(function(ctx){
    var updatedIntent = ctx.event.request.intent;
    var slots = updatedIntent.slots;
    await( CommonSlotsHandler.Handler(ctx) );
    if (ctx.event.request.dialogState === 'STARTED') {
        ctx.emit(':delegate', updatedIntent);
    }
    else if(ctx.event.request.dialogState === 'COMPLETED'){
        if( slots[DEVICE_NAME] && slots[DEVICE_NAME].value ){
            if( !ctx.attributes.thing.connected ){
                ctx.emit(':tell', ctx.t("DEVICE_NOT_CONNECTED").replace("{deviceName}", slots[DEVICE_NAME].value));
                ctx.emit(":responseReady");
            }else{
                try{
                    if( ctx.attributes.thing.status.event === "unlock" ){
                        ctx.emit(':tell', ctx.t("DEVICE_ALREADY_UNLOCKED").replace("{deviceName}", slots[DEVICE_NAME].value));
                        ctx.emit(":responseReady");
                        return;
                    }
                    if( ctx.attributes.thing && ctx.attributes.thing.properties.pin 
                        && !ctx.attributes.thing.properties.appAuth && !slots[PIN].value ){
                        ctx.emit(
                            ':elicitSlot', PIN, 
                            Utils.getRandomArrayItem(ctx.t("PIN_CONFIRM")), 
                            Utils.getRandomArrayItem(ctx.t("PIN_CONFIRM")), 
                            updatedIntent
                        );
                    }else{
                        if( slots[PIN].value && parseInt(slots[PIN].value) !== ctx.attributes.thing.properties.pin ){
                            if( ctx.attributes.pinUnlockAttemps < PIN_UNLOCK_MAX_ATTEMPS ){
                                ++ctx.attributes.pinUnlockAttemps;
                                ctx.emit(
                                    ':elicitSlot', PIN, 
                                    Utils.getRandomArrayItem(ctx.t("WRONG_PIN")), 
                                    Utils.getRandomArrayItem(ctx.t("PIN_CONFIRM")), 
                                    updatedIntent
                                );
                            }else{
                                ctx.emit(':tell', Utils.getRandomArrayItem(ctx.t("WRONG_PIN_MAX_ATTEMPS")).replace("{deviceName}", slots[DEVICE_NAME].value));
                                ctx.emit(":responseReady");
                            }
                            return;
                        }
                        var directive = Utils.callDirectiveService(
                            ctx.event,
                            slots[PIN].value ? ctx.t("UNLOCKING_DEVICE").replace("{deviceName}", slots[DEVICE_NAME].value) : 
                            ctx.t("UNLOCK_CONFIRM_IDENTITY")
                        )
                        .catch(function(error){
                            Logger.logError(error);
                            ctx.emit(':tellWithCard', ctx.t("GENERAL_ERROR_UNLOCK"), ctx.t("ERROR"), ctx.t("GENERAL_ERROR_UNLOCK"));
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
                                /* Device report unlock event then response OK */
                                if( message && message.status && message.status.event === "unlock" ){
                                    ctx.emit(':tell', Utils.getRandomArrayItem(ctx.t("DEVICE_UNLOCKED")).replace("{deviceName}", slots[DEVICE_NAME].value));
                                    ctx.emit(":responseReady");
                                }
                                else{
                                    /* Device can't unlock, then response with error */
                                    ctx.emit(':tell', ctx.t("CANT_UNLOCK").replace("{deviceName}",slots[DEVICE_NAME].value));
                                    ctx.emit(":responseReady");
                                }
                        });
                        var rampiotClient = new RampiotClient();  
                        var thingType = ctx.attributes.thing.type._id;
                        Logger.logDebug("Device type: "+thingType);
                        var deviceInfo = RampiotDeviceFactory.getRampiotDeviceInfo(thingType);                        
                        var resp = await(rampiotClient.sendCommand(
                            ctx.attributes.accessToken, 
                            ctx.attributes.thing._id, 
                            slots[PIN].value ? deviceInfo.parseEvent("pin_unlock", {pin:slots[PIN].value}) : deviceInfo.parseEvent("unlock")
                        ));                        
                    }
                }catch(exc){
                    Logger.logError(exc);
                    /** Already on requested status */
                    if( exc && exc.code && exc.code === 1057 ){
                        ctx.emit(':tell', Utils.getRandomArrayItem(ctx.t("DEVICE_UNLOCKED")).replace("{deviceName}", slots[DEVICE_NAME].value));
                        ctx.emit(":responseReady");
                    }else{
                        ctx.emit(':tellWithCard', ctx.t("GENERAL_ERROR_UNLOCK"), ctx.t("ERROR"), ctx.t("GENERAL_ERROR_UNLOCK"));
                        ctx.emit(":responseReady");
                    }
                }
            }            
        }
    }else{
        ctx.emit(':delegate', updatedIntent);
    }
});