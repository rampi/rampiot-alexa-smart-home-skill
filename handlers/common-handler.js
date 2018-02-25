/* jshint node: true */
"use strict";

var async = require('asyncawait/async');
var await = require('asyncawait/await');
var RampiotClient = require("./../service/rampiot-client").RampiotClient;
var Utils = require("./../utils/utils");
var RampiotDeviceFactory = require("./../rampiot-devices/rampiot-device-factory");
var CommonSlotsHandler = require("./common-slots-handler");
var Logger = Utils.Logger;

/*Slots Name*/
var DEVICE_NAME = "deviceName";
var ACTION = "genAction";

exports.Handler = async(function(ctx){
    var updatedIntent = ctx.event.request.intent;
    ctx.attributes.accessToken = ctx.event.session.user.accessToken;
    /** Checking if account is linked validating if access token comes with lambda request */
    if( !ctx.attributes.accessToken ){
        ctx.emit(':tellWithLinkAccountCard', ctx.t("ACCOUNT_NOT_LINKED"));
        ctx.emit(":responseReady");
        return false;
    }
    var rampiotClient = new RampiotClient();
    Logger.logDebug("Access Token: "+ctx.attributes.accessToken);
    /*Getting linked info user using token*/
    if( ctx.attributes && !ctx.attributes.user && !ctx.attributes.things ){
        var user = await( rampiotClient.getOwnerInfo(ctx.attributes.accessToken) );
        var userThings = await( rampiotClient.getUserThings(ctx.attributes.accessToken) );
        ctx.attributes.user = user.info;
        ctx.attributes.things = [];
        userThings.forEach(function(thingData){
            if( Utils.isRampiotDeviceAlexaCompatible(thingData._id.type._id) ){
                thingData.list.forEach(function(thing){
                    thing.type = {
                        _id: thingData._id.type._id
                    };
                    ctx.attributes.things.push(thing);
                });
            }            
        });        
        Logger.logDebug("Loaded user by token: "+JSON.stringify(user.info));
    }
    /**
     * If user have only one thing, then fill deviceName and set thing 
     * session attribute for skip elicit slot deviceName
     */
    if( ctx.attributes.things.length === 1 ){
        ctx.attributes.thing = ctx.attributes.things[0];
        var thingType = ctx.attributes.thing.type._id;
        var deviceInfo = RampiotDeviceFactory.getRampiotDeviceInfo(thingType);
        deviceInfo.init(ctx.attributes.user, ctx.attributes.thing, ctx);
        var pActions = deviceInfo.getPossibleActions();            
        if( ctx.event.request.type !== 'LaunchRequest' ){
            var slots = updatedIntent.slots;
            slots[DEVICE_NAME].value = ctx.attributes.thing.name;
            /**
             * If device have only one action available, then skip elicit slot genAction
             * and set this, for example, device smart door only have security check as 
             * scheduleable action.
             */
            if( slots[ACTION] && pActions.length === 1 ){
                slots[ACTION].value = ctx.t("ACTIONS."+thingType+"."+pActions[0].code+".description");
            }
            CommonSlotsHandler.Handler(ctx);
        }else{
            /**
             * If user have only one thing and thing have only one possible action,
             * then fill this session attributes for LaunchRequest get an most accurate welcome 
             * message
             */
            ctx.attributes.singleDevice = true;
            ctx.attributes.singleActionName =  
            pActions.length === 1 ? 
                ctx.t("ACTIONS."+thingType+"."+pActions[0].code+".description") : null;
            ctx.attributes.singleAction = pActions.length === 1;
        }
    }
    else if( ctx.attributes.things.length === 0 ){
        ctx.emit(':tell', ctx.t("NO_DEVICE_COMPATIBLE_FOUND"));
        ctx.emit(":responseReady");
        return false;
    }
    return true;
});