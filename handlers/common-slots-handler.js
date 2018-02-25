/* jshint node: true */
"use strict";

var async = require('asyncawait/async');
var await = require('asyncawait/await');
var ThingDAO = require("./../dao/thing-dao").ThingDAO;
var RampiotClient = require("./../service/rampiot-client").RampiotClient;
var Utils = require("./../utils/utils");
var RampiotDeviceFactory = require("./../rampiot-devices/rampiot-device-factory");
var Logger = Utils.Logger;
var thingDao = new ThingDAO();

/*Slots Name*/
var DEVICE_NAME = "deviceName";
var ACTION = "genAction";
var MAX_REPROMPT = 2;

exports.fillDeviceData = function(ctx, thing){
    
    var updatedIntent = ctx.event.request.intent;
    var slots = updatedIntent.slots;

    /** If device's found, then fill possibleActions and possibleEvents slots */    
    ctx.attributes.thing = thing;
    var deviceInfo = RampiotDeviceFactory.getRampiotDeviceInfo(ctx.attributes.thing.type._id);
    deviceInfo.init(ctx.attributes.user, ctx.attributes.thing, ctx);
    /** Getting possible actions/events from device */
    var actions = deviceInfo.getPossibleActions();
    var events = deviceInfo.getPossibleEvents();
    Logger.logDebug("Actions: "+JSON.stringify(actions));
    Logger.logDebug("Events: "+JSON.stringify(events));

    ctx.attributes.thing.possibleActions = {};
    ctx.attributes.thing.possibleActionsWords = [];

    ctx.attributes.thing.possibleEvents = {};                
    ctx.attributes.thing.possibleEventsWords = [];

    if( slots.possibleDeviceActions ){
        slots.possibleDeviceActions.value = "";
        /** Filling possible device actions*/
        actions.forEach(function(action, index){                        
            /** Getting the action word from action code in the current language code*/
            var act = ctx.t("ACTIONS."+ctx.attributes.thing.type._id+"."+action.code);
            var actionDesc = act.description.toLowerCase();
            /** This is an array with valid word actions, this will be compared with word the user going to say*/
            ctx.attributes.thing.possibleActionsWords.push(actionDesc);                        
            /** This is a KV from later convert action word to action code */
            ctx.attributes.thing.possibleActions[actionDesc] = action.code;
            if( act.variants && act.variants.length > 0 ){
                act.variants.forEach(function(variant){
                    ctx.attributes.thing.possibleActionsWords.push(variant);
                    ctx.attributes.thing.possibleActions[variant] = action.code;
                });
            }
            slots.possibleDeviceActions.value += actionDesc;
            if( index+1 === actions.length-1 ){
                slots.possibleDeviceActions.value += ", "+ctx.t("AND")+" ";
            }else if(index+1 < actions.length){
                slots.possibleDeviceActions.value += ", ";
            }
        });
        /**
         * If device have only one action available, then skip elicit slot genAction
         * and set this.
         */
        if( slots[ACTION] && actions.length === 1 ){
            slots[ACTION].value = ctx.t("ACTIONS."+ctx.attributes.thing.type._id+"."+actions[0].code+".description");
        }
    }

    if( slots.possibleDeviceEvents ){
        slots.possibleDeviceEvents.value = "";
        /** Filling possible device events*/
        events.forEach(function(event, index){
            Logger.logDebug("Event: "+event);
            /** Getting the event word from event code in the current language code*/
            var eventObj = ctx.t("EVENTS."+ctx.attributes.thing.type._id+"."+event);
            var eventDesc = eventObj.description.toLowerCase();
            /** This is an array with valid word events, this will be compared with word the user going to say*/
            ctx.attributes.thing.possibleEventsWords.push(eventDesc);
            /** This is a KV from later convert event word to event code */
            ctx.attributes.thing.possibleEvents[eventDesc] = event;
            if( eventObj.variants && eventObj.variants.length > 0 ){
                eventObj.variants.forEach(function(variant){
                    ctx.attributes.thing.possibleEventsWords.push(variant);
                    ctx.attributes.thing.possibleEvents[variant] = event;
                });
            }
            slots.possibleDeviceEvents.value += ctx.t(eventDesc);            
            if( index+1 === events.length-1 ){
                slots.possibleDeviceEvents.value += ", "+ctx.t("AND")+" ";
            }else if(index+1 < events.length){
                slots.possibleDeviceEvents.value += ", ";
            }
        });
    }
    
    Logger.logDebug("Possible actions: "+(slots.possibleDeviceActions ? slots.possibleDeviceActions.value : []));
    Logger.logDebug("Possible events: "+(slots.possibleDeviceEvents ? slots.possibleDeviceEvents.value : []));

};

exports.Handler = async(function(ctx){
    var updatedIntent = ctx.event.request.intent;
    var slots = updatedIntent.slots;
    /** If slot 'deviceName' is set, then find if this device exists in rampiot and if this is associated to linked account*/
    if( !ctx.attributes.nameSet && slots[DEVICE_NAME] && slots[DEVICE_NAME].value ){
        try{
            /**Assign session thing to thing variable, if it is set then skip find device by name*/
            var thing = ctx.attributes.thing;
            try{
                if( !thing ){
                    /**Calling service for get user thing by name */
                    Logger.logDebug("Finding device by name..");
                    thing = ctx.attributes.things.find(function(_thing){
                        return _thing.name.toLowerCase() === slots[DEVICE_NAME].value.toLowerCase();
                    });
                    ctx.attributes.thing = thing;                    
                }
            }catch(ex){
                Logger.logError(ex);
            }
            Logger.logDebug("Device found: "+JSON.stringify(thing));
            if( !thing ){
                if( !ctx.attributes.deviceNameRepromptCount || ctx.attributes.deviceNameRepromptCount <= MAX_REPROMPT ){
                    Logger.logDebug("Device "+slots[DEVICE_NAME].value+" not found !!");
                    var msg = ctx.t("DEVICE_NOT_FOUND").
                    replace("{deviceName}", slots[DEVICE_NAME].value);
                    ctx.emit(':elicitSlot', DEVICE_NAME, msg, ctx.t("DEVICE_NOT_FOUND_REPROMPT"), updatedIntent);
                    ctx.attributes.deviceNameRepromptCount = !ctx.attributes.deviceNameRepromptCount ? 1 : ++ctx.attributes.deviceNameRepromptCount;
                }else{
                    ctx.emit(':tell', ctx.t("DEVICE_NOT_FOUND_MAX_REPROMPT"));
                    ctx.emit(':responseReady');
                }
            }else{
                ctx.attributes.nameSet = true;                
                exports.fillDeviceData(ctx, thing);
                return true;
            }
        }catch(exc){
            Logger.logError(exc);
        }
    }
    return false;
});