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
var DEVICE_ACTION = "action";
var DO_YOU_WANT = "doYouWantAction";
var MAX_ATTEMPS = 2;

exports.Handler = async(function(ctx){
    var updatedIntent = ctx.event.request.intent;
    var slots = updatedIntent.slots;
    await( CommonSlotsHandler.Handler(ctx) );
    if (ctx.event.request.dialogState === 'STARTED') {
        ctx.emit(':delegate', updatedIntent);
    }
    else if(ctx.event.request.dialogState === 'COMPLETED'){
        try{
            var thing = ctx.attributes.thing;
            var deviceInfo = RampiotDeviceFactory.getRampiotDeviceInfo(thing.type._id);            
            var status = deviceInfo.getDeviceStatus(thing.status);
            var actFromEvent = deviceInfo.getActionFromEvent(status);
            var statusDesc = ctx.t("EVENTS."+thing.type._id+"."+status).description;
            if( slots[DEVICE_NAME] && slots[DEVICE_NAME].value && !slots[DO_YOU_WANT].value ){
                if( actFromEvent ){
                    slots[DEVICE_ACTION].value = actFromEvent;
                    ctx.emit(
                        ':elicitSlot', DO_YOU_WANT, 
                        ctx.t("DEVICE_STATUS_DYW").replace(new RegExp("{deviceName}", 'g'), slots[DEVICE_NAME].value).
                        replace("{deviceStatus}", statusDesc).
                        replace("{deviceAction}", slots[DEVICE_ACTION].value), 
                        ctx.t("DEVICE_STATUS_DYW_REPROMPT").replace("{deviceName}", slots[DEVICE_NAME].value).
                        replace("{deviceAction}", slots[DEVICE_ACTION].value), 
                        updatedIntent
                    );
                }else{
                    ctx.emit(':tell', 
                        Utils.getRandomArrayItem(ctx.t("DEVICE_STATUS")).
                        replace(new RegExp("{deviceName}", 'g'), slots[DEVICE_NAME].value).
                        replace("{deviceStatus}", statusDesc)
                    );
                    ctx.emit(":responseReady");
                }
            }
            else if( slots[DO_YOU_WANT] && slots[DO_YOU_WANT].value ){      
                if( Utils.containsValue(ctx.t("YES_VARIATIONS"), slots[DO_YOU_WANT].value) ){
                    var directive = Utils.callDirectiveService(
                        ctx.event,
                        ctx.t("ACTIONS."+thing.type._id+"."+actFromEvent).progress.replace("{deviceName}", slots[DEVICE_NAME].value)
                    )
                    .catch(function(error){
                        Logger.logError(error);
                        ctx.emit(':tellWithCard', ctx.t("GENERAL_ERROR"), ctx.t("ERROR"), ctx.t("GENERAL_ERROR"));
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
                            /* Device report correct event then response OK */
                            var expected = deviceInfo.parseEvent(actFromEvent);
                            var st = Utils.join(message.status, expected);
                            if( message && message.status && 
                                Utils.getObjectHash(st) === Utils.getObjectHash(expected) ){
                                ctx.emit(':tell', ctx.t("ACTIONS."+thing.type._id+"."+actFromEvent).success.replace("{deviceName}", slots[DEVICE_NAME].value));
                                ctx.emit(":responseReady");
                            }
                            else{
                                /* Device can't xxx, then response with error */
                                ctx.emit(':tell', ctx.t("ACTIONS."+thing.type._id+"."+actFromEvent).fail.replace("{deviceName}", slots[DEVICE_NAME].value));
                                ctx.emit(":responseReady");
                            }
                    });
                    var rampiotClient = new RampiotClient();  
                    var thingType = ctx.attributes.thing.type._id;
                    Logger.logDebug("Device type: "+thingType);
                    var resp = await(rampiotClient.sendCommand(
                        ctx.attributes.accessToken, 
                        ctx.attributes.thing._id, 
                        deviceInfo.parseEvent(actFromEvent)
                    ));
                }
                else if( Utils.containsValue(ctx.t("NO_VARIATIONS"), slots[DO_YOU_WANT].value) ){
                    ctx.emit(':tell', ctx.t("OK"));
                    ctx.emit(":responseReady");
                }
                else{
                    if( !ctx.attributes.yesNoAttemps ){
                        ctx.attributes.yesNoAttemps = 0;
                    }
                    if( ctx.attributes.yesNoAttemps < MAX_ATTEMPS ){
                        ++ctx.attributes.yesNoAttemps;
                        var reprompt = ctx.t("DEVICE_STATUS_DYW_REPROMPT").replace("{deviceName}", slots[DEVICE_NAME].value).
                        replace("{deviceAction}", slots[DEVICE_ACTION].value);
                        ctx.emit(
                            ':elicitSlot', DO_YOU_WANT, 
                            ctx.t(
                                "DEVICE_STATUS_DYW_INVALID_VALUE").replace("{word}", slots[DO_YOU_WANT].value).
                                replace("{deviceName}", slots[DEVICE_NAME].value).
                                replace("{deviceAction}",  slots[DEVICE_ACTION].value), 
                            reprompt, 
                            updatedIntent
                        );                        
                    }else{
                        ctx.emit(':tell', ctx.t("DEVICE_STATUS_DYW_ERROR"));
                        ctx.emit(":responseReady");
                    }
                }
            }
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