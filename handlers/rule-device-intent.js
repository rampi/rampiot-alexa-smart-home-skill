/* jshint node: true */
"use strict";

var durational = require("durational");
var moment = require('moment');
var async = require('asyncawait/async');
var await = require('asyncawait/await');
var RampiotClient = require("./../service/rampiot-client").RampiotClient;
var RampiotDeviceFactory = require("./../rampiot-devices/rampiot-device-factory");
var RuleUtils = require("./../utils/rule-utils");
var Utils = require("./../utils/utils");
var Constants = require("./../utils/constants");
var CommonSlotsHandler = require("./common-slots-handler");
var Logger = Utils.Logger;

/*Slots Name*/
var DEVICE_NAME = "deviceName";
var DAY_OF_WEEK = "dayOfWeek";
var DEVICE_EVENT = "deviceEvent";
var POSSIBLE_DEVICE_EVENTS = "possibleDeviceEvents";
var ACTION_TO_DO = "actionToDo";
var START_HOUR = "startHour";
var END_HOUR = "endHour";
var DELAY_TIME = "delayTime";

var RENDER_CARD_WHEN_EVENT_MORE_THAN = 3;

exports.Handler = async(function(ctx){
    var updatedIntent = ctx.event.request.intent;
    var slots = updatedIntent.slots;
    var thingType = ctx.attributes.thing.type._id;
    Logger.logDebug("Device type: "+thingType);
    var deviceInfo = RampiotDeviceFactory.getRampiotDeviceInfo(thingType);
    if (ctx.event.request.dialogState === 'STARTED') {
        /**This slot is not mandatory on interaction model because if it have more than 3 options to select, 
         * then this going to render a card with all options */                
        if( slots[DEVICE_EVENT] && !slots[DEVICE_EVENT].value ){
            var prompt = ctx.t("RULE_EVENT_PROMPT").
                    replace("{deviceName}", slots[DEVICE_NAME].value).
                    replace("{possibleDeviceEvents}", slots.possibleDeviceEvents.value);
            /**If events are more than 4, then tell with card that contains all event options */
            if( ctx.attributes.thing.possibleEventsWords.length > RENDER_CARD_WHEN_EVENT_MORE_THAN ){
                var pde = "";
                ctx.attributes.thing.possibleEventsWords.forEach(function(evt){
                    pde += "- "+evt+"\n";
                });                
                ctx.emit(
                    ':elicitSlotWithCard', 
                    DEVICE_EVENT, 
                    prompt, 
                    prompt, 
                    ctx.t("RULE_EVENT_CARD_TITLE").replace("{deviceName}",slots[DEVICE_NAME].value), 
                    pde,
                    updatedIntent
                );
            }else{
                ctx.emit(
                    ':elicitSlot', 
                    DEVICE_EVENT, 
                    prompt, 
                    prompt,                     
                    updatedIntent
                );
            }
        }else{
            ctx.emit(':delegate', updatedIntent);
        }        
    }
    else if (ctx.event.request.dialogState !== 'COMPLETED'){
        updatedIntent = ctx.event.request.intent;
        if( await( CommonSlotsHandler.Handler(ctx) ) ){            
            ctx.emit(':delegate', updatedIntent);            
        }        
        if( slots[START_HOUR] && slots[START_HOUR].value && slots.startHourFormatted ){
            /**If specified start hour is an time-related utterances, then convert it in a hours range*/
            var timeUtt = Utils.TIME_RELATED_UTTERANCES[slots[START_HOUR].value];
            if( timeUtt ){
                slots[START_HOUR].value = timeUtt.start.formatted;
                slots[END_HOUR].value = timeUtt.end.formatted;
            }
            slots.startHourFormatted.value = moment(slots[START_HOUR].value, ["HH:mm"]).format("h:mm A");
        }
        if( slots[END_HOUR] && slots[END_HOUR].value && slots.endHourFormatted ){
            var start = moment(slots[START_HOUR].value, ["HH:mm"]).toDate();
            var end = moment(slots[END_HOUR].value, ["HH:mm"]).toDate();
            slots.endHourFormatted.value = moment(slots[END_HOUR].value, ["HH:mm"]).format("h:mm A");
            if( end.getHours() < start.getHours() ){
                slots.endHourFormatted.value += " "+ctx.t("THE_NEXT_DAY")+" ";
            }
            if( !slots.delayTimeFormatted.value ){
                slots.delayTimeFormatted.value = " ";
            }
        }
        if( slots[DAY_OF_WEEK] && slots[DAY_OF_WEEK].value && !ctx.attributes.dayOfWeekSet ){
            var restrictedDowMap = ctx.t("RESTRICTED_DOW_SLOT_KV");            
            var dowCode = restrictedDowMap[slots[DAY_OF_WEEK].value.toLowerCase()];            
            if( Utils.containsValue(RuleUtils.getWildCardDOW(), dowCode) ){
                slots.dayOfWeekFormatted.value = slots[DAY_OF_WEEK].value;
            }else{
                slots.dayOfWeekFormatted.value = "On "+slots[DAY_OF_WEEK].value;
            }
            ctx.attributes.dayOfWeekSet = true;
        }
        if( slots[DELAY_TIME] && slots[DELAY_TIME].value && !ctx.attributes.delayTimeSet ){
            try{
                ctx.attributes.formattedDelayTime = Utils.durationJSONToWords(durational.fromString(slots[DELAY_TIME].value));
                ctx.attributes.delayTimeSet = true;
                slots.delayTimeFormatted.value = " for "+ctx.attributes.formattedDelayTime;
            }catch(exc){
                Logger.logError(exc);
                var _msg = ctx.t("INVALID_DELAY_TIME_SLOT_VALUE").
                replace(new RegExp("{actionToDo}", 'g'), slots[ACTION_TO_DO].value).
                replace("{deviceEvent}", slots[DEVICE_EVENT].value).
                replace("{deviceName}", slots[DEVICE_NAME].value);                
                var _repromptMsg = ctx.t("INVALID_DELAY_TIME_SLOT_VALUE_REPROMPT").
                replace("{deviceName}", slots[DEVICE_NAME].value).
                replace("{actionToDo}", slots[ACTION_TO_DO].value).
                replace("{deviceEvent}", slots[DEVICE_EVENT].value);
                ctx.emit(':elicitSlot', DELAY_TIME, _msg, _repromptMsg, updatedIntent);
            }
        }
        if( !ctx.attributes.deviceEventSet && slots[DEVICE_EVENT] && slots[DEVICE_EVENT].value ){
            if( !Utils.containsValue(ctx.attributes.thing.possibleEventsWords, slots[DEVICE_EVENT].value) ){
                var msg = ctx.t("INVALID_DEVICE_EVENT_SLOT_VALUE").
                replace("{deviceEvent}", slots[DEVICE_EVENT].value).
                replace("{deviceName}", slots[DEVICE_NAME].value).
                replace("{possibleDeviceEvents}", slots[POSSIBLE_DEVICE_EVENTS].value);
                var repromptMsg = ctx.t("INVALID_DEVICE_EVENT_SLOT_VALUE_REPROMPT").
                replace("{deviceName}", slots[DEVICE_NAME].value).
                replace("{deviceEvent}", slots[DEVICE_EVENT].value).
                replace("{possibleDeviceEvents}", slots[POSSIBLE_DEVICE_EVENTS].value);
                ctx.emit(':elicitSlot', DEVICE_EVENT, msg, repromptMsg, updatedIntent);
            }else{
                ctx.attributes.deviceEventSet = true;
                var deviceEventCode = ctx.attributes.thing.possibleEvents[slots[DEVICE_EVENT].value];
                Logger.logDebug("Device event code: "+deviceEventCode);                
                /**Finding if the selected event can fire an action, for example, 
                 * the close event in a door can fire an lock action */
                var actionFromEvent = deviceInfo.getActionFromEvent(deviceEventCode);
                Logger.logDebug("Action from event: "+actionFromEvent);
                if( !ctx.attributes.actionToDoSet && actionFromEvent ){
                    var actionDescription = ctx.t("ACTIONS."+thingType+"."+actionFromEvent+".description");
                    ctx.attributes.thing.actionFromEvent = actionFromEvent;
                    /**This array is for slot value validation, the word that user says will be compared with this array,
                     * if word not found, then elicit actionToDo slot
                     */
                    var variants = ctx.t("POSSIBLE_RULE_ACTIONS_VARIANTS");
                    variants.DEVICE_ACTION.forEach(function(deviceAct, index){
                        deviceAct = deviceAct.replace("{deviceEvent}", actionDescription.toLowerCase()).
                                    replace("{deviceName}", slots[DEVICE_NAME].value.toLowerCase());
                        variants.DEVICE_ACTION[index] = deviceAct;
                    });                    
                    variants.DEVICE_ACTION_AND_NOTIFY.forEach(function(deviceActAndNot, index){
                        deviceActAndNot = deviceActAndNot.replace("{deviceEvent}", actionDescription);
                        variants.DEVICE_ACTION_AND_NOTIFY[index] = deviceActAndNot;
                    });
                    ctx.attributes.thing.possibleActionsToDoWords = [].
                    concat(variants.SEND_NOTIFICATION).
                    concat(variants.DEVICE_ACTION).
                    concat(variants.DEVICE_ACTION_AND_NOTIFY);
                    Logger.logDebug("All accepted words: "+JSON.stringify(ctx.attributes.thing.possibleActionsToDoWords));
                    /**
                     * This string contains all posible actions to do, this string will be presented on prompt voice
                     */
                    ctx.attributes.thing.possibleActionsToDo = ctx.t("SEND_NOTIFICATION")+", "+(actionDescription+" "+slots[DEVICE_NAME].value)+", "+ctx.t("OR")+" "+actionDescription+" "+ctx.t("AND")+" "+ctx.t("NOTIFY");
                    /**
                     * This array contains key/values association between words variants and their representation as int code, this map is used later by rule-utils.js for
                     * build the json rule.
                     * Example: If user says: "send notification", then slot DEVICE_EVENT will be filled, and later rule-utils will search in the map the code for word "send notification",
                     * then this map will return Constants.CODE_SEND_NOTIFICATION (value of 1), and rule-utils can build json rule with an send notification action                     
                     */
                    ctx.attributes.thing.possibleActionsToDoMap = [];
                    variants.SEND_NOTIFICATION.forEach(function(sn){
                        ctx.attributes.thing.possibleActionsToDoMap.push({
                            key: sn, 
                            value: Constants.CODE_SEND_NOTIFICATION
                        });
                    });
                    variants.DEVICE_ACTION.forEach(function(da){
                        ctx.attributes.thing.possibleActionsToDoMap.push({
                            key: da, 
                            value: Constants.CODE_DEVICE_ACTION
                        });
                    });
                    variants.DEVICE_ACTION_AND_NOTIFY.forEach(function(dan){
                        ctx.attributes.thing.possibleActionsToDoMap.push({
                            key: dan, 
                            value: Constants.CODE_DEVICE_ACTION_AND_NOTIFY
                        });
                    });
                    /** Ask to user what action want do after event */
                    var atdMsg = ctx.t("ACTIONS_TO_DO").
                    replace("{deviceName}", slots[DEVICE_NAME].value).
                    replace("{deviceEvent}", slots[DEVICE_EVENT].value).
                    replace("{possibleActionsToDo}", ctx.attributes.thing.possibleActionsToDo);
                    var atdMsgR = ctx.t("ACTIONS_TO_DO_REPROMPT").
                    replace("{possibleActionsToDo}", ctx.attributes.thing.possibleActionsToDo);
                    ctx.emit(':elicitSlot', ACTION_TO_DO, atdMsg, atdMsgR, updatedIntent);
                }else{
                    slots[ACTION_TO_DO].value = ctx.t("SEND_NOTIFICATION");
                    ctx.attributes.actionToDoSet = true;
                    ctx.emit(':delegate', updatedIntent);
                }
            }
        }
        else if( !ctx.attributes.actionToDoSet && slots[DEVICE_NAME] && slots[DEVICE_NAME].value ){
            if( !Utils.containsValue(ctx.attributes.thing.possibleActionsToDoWords, slots[ACTION_TO_DO].value) ){
                var _atdMsg = ctx.t("INVALID_ACTIONS_TO_DO").
                replace("{deviceName}", slots[DEVICE_NAME].value).
                replace("{actionToDo}", slots[ACTION_TO_DO].value).
                replace("{possibleActionsToDo}", ctx.attributes.thing.possibleActionsToDo);
                var _atdMsgR = ctx.t("ACTIONS_TO_DO_REPROMPT").
                replace("{possibleActionsToDo}", ctx.attributes.thing.possibleActionsToDo);
                ctx.emit(':elicitSlot', ACTION_TO_DO, _atdMsg, _atdMsgR, updatedIntent);
            }else{
                ctx.attributes.actionToDoSet = true;
                ctx.emit(':delegate', updatedIntent);
            }       
        }
        else if( !ctx.attributes.delayTimeSet && slots[ACTION_TO_DO] && slots[ACTION_TO_DO].value ){
            var atd = ctx.attributes.thing.possibleEvents[slots[DEVICE_EVENT].value.toLowerCase()];
            if( deviceInfo.requiresDelay(atd) ){
                var delayMsg = ctx.t("RULE_DELAY_PROMPT").
                replace("{deviceName}", slots[DEVICE_NAME].value).
                replace("{actionToDo}", slots[ACTION_TO_DO].value).
                replace("{deviceEvent}", slots[DEVICE_EVENT].value);
                ctx.emit(':elicitSlot', DELAY_TIME, delayMsg, delayMsg, updatedIntent);                    
            }else{                
                ctx.emit(':delegate', updatedIntent);
            }
        }
        else{            
            ctx.emit(':delegate', updatedIntent);                     
        }
    }else{
        var locale = ctx.event.request.locale;
        var _slots = updatedIntent.slots;
        if( ctx.event.request.intent.confirmationStatus !== "DENIED" ){
            var ruleDescription = ctx.t("NEW_RULE_END").
            replace("{actionToDo}", _slots[ACTION_TO_DO].value).
            replace("{deviceName}", _slots[DEVICE_NAME].value).
            replace("{deviceEvent}", _slots[DEVICE_EVENT].value).
            replace("{startHour}", _slots.startHourFormatted.value).
            replace("{endHour}", _slots.endHourFormatted.value).
            replace("{dayOfWeek}", _slots.dayOfWeekFormatted.value).
            replace("{delayTime}", _slots.delayTimeFormatted.value);
            try{
                var rampiotClient = new RampiotClient();
                var jsonRule = RuleUtils.parseSlotsToJSONRule(
                    ruleDescription, _slots, ctx.attributes.user.userId, ctx.attributes.thing._id, 
                    ctx.attributes.thing.type._id, ctx.t("RESTRICTED_DOW_SLOT_KV"), 
                    ctx.attributes.user.email, ctx.t("ACTION_EMAIL_SUBJECT"), 
                    ctx.t("ACTION_EMAIL_MESSAGE_TEMPLATE"), ctx.t("ACTION_PUSH_MESSAGE_TEMPLATE"),
                    ctx.attributes.thing.actionFromEvent, ctx.attributes.thing.possibleActionsToDoMap, 
                    ctx.attributes.thing.possibleEvents
                );
                Logger.logDebug("JSON-RULE: "+JSON.stringify(jsonRule));
                await( rampiotClient.createRule(
                    ctx.attributes.accessToken, 
                    ctx.attributes.thing._id, 
                    jsonRule 
                ));
                var cardMessage = ctx.t("NEW_RULE_CARD").
                replace("{actionToDo}", _slots[ACTION_TO_DO].value).
                replace("{deviceEvent}", _slots[DEVICE_EVENT].value).
                replace("{deviceName}", _slots[DEVICE_NAME].value).
                replace("{startHour}", _slots.startHourFormatted.value).
                replace("{endHour}", _slots.endHourFormatted.value).
                replace("{dayOfWeek}", _slots.dayOfWeekFormatted.value).
                replace("{delayTime}", _slots.delayTimeFormatted.value);
                var interjection = Utils.getRandomArrayItem(ctx.t("SUCCESS_INTERJECTIONS"));
                var endMessage = ctx.t("END_MESSAGE").replace("{interjection}", interjection);
                endMessage = endMessage.replace("{endPhrase}", Utils.getRandomArrayItem(ctx.t("RULE_END_PHRASES")));
                ctx.emit(':tellWithCard', endMessage, interjection, cardMessage);
                ctx.emit(":responseReady");
            }catch(exc){
                Logger.logError(exc);
                if( exc.code === 1028 ){
                    ctx.emit(':tellWithCard', ctx.t("RULE_ALREADY_EXISTS"), ctx.t("ERROR_ALREADY_EXISTS"), ruleDescription);
                    ctx.emit(":responseReady");
                }else{
                    ctx.emit(':tellWithCard', ctx.t("GENERAL_ERROR_NEW_RULE"), ctx.t("ERROR"), ctx.t("ERROR_SAVING")+" \n"+ruleDescription);
                    ctx.emit(":responseReady");
                }
            }
        }else{
            ctx.response.speak(Utils.getRandomArrayItem(ctx.t("END_NO_CONFIRM_INTENT")));
            ctx.emit(':responseReady');
        }
    }
});