/* jshint node: true */
"use strict";

var Alexa = require('alexa-sdk');
var Utils = require("./utils/utils");
var async = require('asyncawait/async');
var await = require('asyncawait/await');
var RampiotClient = require("./service/rampiot-client").RampiotClient;
var CommonHandler = require("./handlers/common-handler");
var Logger = Utils.Logger;

var handlers = {
    'LaunchRequest': function () {
        this.attributes.accessToken = this.event.session.user.accessToken;
        if( !this.attributes.accessToken ){
            this.emit(':tellWithLinkAccountCard', this.t("ACCOUNT_NOT_LINKED"));
            this.emit(":responseReady");
            return;
        }
        Logger.logDebug("Access token: "+this.attributes.accessToken);
        Logger.logDebug("Rampiot smart home is launched, waiting user response");
        var pass = await( CommonHandler.Handler(this) );
        if( pass ){
            if( !this.attributes.singleDevice ){
                this.response.
                speak(Utils.getRandomArrayItem(this.t("WELCOME_MESSAGES"))).
                listen(this.t("REWELCOME_MESSAGE"));
                this.emit(':responseReady');
            }else if( this.attributes.singleDevice && this.attributes.singleAction ){
                var wMessage = Utils.getRandomArrayItem(this.t("WELCOME_MESSAGES_SINGLE_DEVICE_SINGLE_ACTION"));
                wMessage = wMessage.
                        replace("{deviceName}", this.attributes.thing.name).
                        replace("{singleAction}", this.attributes.singleActionName);
                this.response.speak(wMessage).
                listen(this.t("REWELCOME_MESSAGE_SINGLE_DEVICE"));
                this.emit(':responseReady');
            }else{
                var _wMessage = Utils.getRandomArrayItem(this.t("WELCOME_MESSAGES_SINGLE_DEVICE_MULTI_ACTIONS"))
                .replace("{deviceName}", this.attributes.thing.name);
                this.response.speak(_wMessage).
                listen(this.t("REWELCOME_MESSAGE_SINGLE_DEVICE"));
                this.emit(':responseReady');
            }
        }
    },    
    'DeviceStatusIntent': async(function(){
        var pass = await( CommonHandler.Handler(this) );
        if( pass ){
            await( require("./handlers/device-status-intent").Handler(this) );
        }
    }),
    'DeviceLockIntent': async(function(){
        var pass = await( CommonHandler.Handler(this) );
        if( pass ){
            await( require("./handlers/device-lock-intent").Handler(this) );
        }
    }),
    'SecureUnlockDeviceIntent': async(function(){
        var pass = await( CommonHandler.Handler(this) );
        if( pass ){
            if( !this.attributes.pinUnlockAttemps ){
                this.attributes.pinUnlockAttemps = 0;
            }
            await( require("./handlers/secure-unlock-device-intent").Handler(this) );
        }
    }),
    'RuleDeviceIntent': async(function(){
        var pass = await( CommonHandler.Handler(this) );
        if( pass ){
            await( require("./handlers/rule-device-intent").Handler(this) );
        }
    }),    
    'ScheduleActionIntent': async(function(){
        var pass = await( CommonHandler.Handler(this) );
        if( pass ){
            await( require("./handlers/schedule-action-intent").Handler(this) );
        }
    }),
    'SessionEndedRequest': function () {
        this.response.speak(this.t("STOPPED"));
        this.emit(":responseReady");
    },
    "AMAZON.HelpIntent": function() {
        this.emit(
            ':askWithCard', 
            this.t("HELP_MESSAGE"), 
            this.t("REWELCOME_MESSAGE"), 
            this.t("HELP_MESSAGE_CARD_TITLE"), 
            this.t("HELP_MESSAGE_CARD")
        );
        this.emit(':responseReady');
    },
    "AMAZON.CancelIntent": function() {
        this.response.speak(this.t("CANCELED"));
        this.emit(':responseReady');
    },
    "AMAZON.StopIntent": function() {
        this.response.speak(this.t("STOPPED"));
        this.emit(':responseReady');
    },
    'Unhandled' : function() {
        this.emit('AMAZON.HelpIntent');
    }
};

exports.handler = async(function(event, context, callback) {
    Logger.logDebug("Event: "+JSON.stringify(event));
    if( event.session.application.applicationId === process.env.APPLICATION_ID ){        
        var alexa = Alexa.handler(event, context, callback);        
        alexa.appId = process.env.APPLICATION_ID;
        alexa.resources = require("./i18n/messages.json");
        alexa.registerHandlers(handlers);        
        alexa.execute();
    }else{
        callback("Invalid application id");
    }
});