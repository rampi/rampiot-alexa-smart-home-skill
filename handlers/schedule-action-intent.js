/* jshint node: true */
"use strict";

var moment = require('moment');
var async = require('asyncawait/async');
var await = require('asyncawait/await');
var ThingDAO = require("./../dao/thing-dao").ThingDAO;
var RampiotClient = require("./../service/rampiot-client").RampiotClient;
var RampiotDeviceFactory = require("./../rampiot-devices/rampiot-device-factory");
var Utils = require("./../utils/utils");
var ScheduledActionUtils = require("./../utils/schedule-action-utils");
var CommonSlotsHandler = require("./common-slots-handler");
var Logger = Utils.Logger;
var thingDao = new ThingDAO();

/*Slots Name*/
var DAY_OF_WEEK = "dayOfWeek";
var HOUR_OF_DAY = "hourOfDay";
var DEVICE_NAME = "deviceName";
var ACTION = "genAction";
var RESTART_INTENT = "restartIntentYesNo";

exports.Handler = async(function(ctx){
    var updatedIntent = ctx.event.request.intent;
    if (ctx.event.request.dialogState === 'STARTED') {        
        ctx.emit(':delegate', updatedIntent);
    }else if (ctx.event.request.dialogState !== 'COMPLETED'){
        var slots = updatedIntent.slots;        
        if( await( CommonSlotsHandler.Handler(ctx) ) ){
            ctx.emit(':delegate', updatedIntent);
        }
        if( slots[HOUR_OF_DAY] && slots[HOUR_OF_DAY].value && slots.hourOfDayFormatted ){
            /**If specified start hour is an time-related utterances, then select end start of range*/
            var timeUtt = Utils.TIME_RELATED_UTTERANCES[slots[HOUR_OF_DAY].value];
            if( timeUtt ){
                slots[HOUR_OF_DAY].value = timeUtt.start.formatted;
            }
            slots.hourOfDayFormatted.value = moment(slots[HOUR_OF_DAY].value, ["HH:mm"]).format("h:mm A");
        }
        if( !ctx.attributes.dowSet && slots[DAY_OF_WEEK] && slots[DAY_OF_WEEK].value ){
            if( !Utils.containsValue(ctx.t("RESTRICTED_DOW_SLOT_VALUES"), slots[DAY_OF_WEEK].value.toLowerCase()) ){
                var msg = ctx.t("INVALID_DOW_SLOT_VALUE").
                replace("{dayOfWeek}", slots[DAY_OF_WEEK].value).
                replace("{deviceName}", slots[DEVICE_NAME].value).
                replace("{genAction}", slots[ACTION].value);
                var repromptMsg = ctx.t("INVALID_DOW_SLOT_VALUE_REPROMPT").
                replace("{deviceName}", slots[DEVICE_NAME].value).
                replace("{genAction}", slots[ACTION].value);
                ctx.emit(':elicitSlot', DAY_OF_WEEK, msg, repromptMsg, updatedIntent);
            }else{
                var restrictedDowMap = ctx.t("RESTRICTED_DOW_SLOT_KV");
                var dowCode = restrictedDowMap[slots[DAY_OF_WEEK].value.toLowerCase()];
                if( Utils.containsValue(ScheduledActionUtils.getWildCardDOW(), dowCode) ){
                    slots.dayOfWeekFormatted.value = slots[DAY_OF_WEEK].value;
                }else{
                    slots.dayOfWeekFormatted.value = "On "+slots[DAY_OF_WEEK].value;
                }
                ctx.attributes.dowSet = true;
                ctx.emit(':delegate', updatedIntent);
            }
        }
        else if( !ctx.attributes.actionSet && slots[ACTION] && slots[ACTION].value ){
            if( Utils.containsValue(ctx.attributes.thing.possibleActionsWords, slots[ACTION].value) ){                
                var actionCode = ctx.attributes.thing.possibleActions[slots[ACTION].value];
                slots[ACTION].value = ctx.t("ACTIONS."+ctx.attributes.thing.type._id+"."+actionCode+".description");
                ctx.attributes.actionSet = true;
                ctx.emit(':delegate', updatedIntent);
            }
            else{
                var _msg = ctx.t("INVALID_ACTION_SLOT_VALUE").
                replace("{action}", slots[ACTION].value).
                replace("{deviceName}", slots[DEVICE_NAME].value).
                replace("{possibleDeviceActions}", slots.possibleDeviceActions.value);                
                var _repromptMsg = ctx.t("INVALID_ACTION_SLOT_VALUE_REPROMPT").
                replace("{action}", slots[ACTION].value).
                replace("{deviceName}", slots[DEVICE_NAME].value).
                replace("{possibleDeviceActions}", slots.possibleDeviceActions.value);
                ctx.emit(':elicitSlot', ACTION, _msg, _repromptMsg, updatedIntent);
            }
        }        
        else{
            ctx.emit(':delegate', updatedIntent);
        }            
    } else {
        var locale = ctx.event.request.locale;
        var _slots = updatedIntent.slots;
        if( ctx.event.request.intent.confirmationStatus !== "DENIED" ){
            var scheduledActionDescription = ctx.t("NEW_SCHEDULE_ACTION_END").
            replace("{action}", _slots[ACTION].value).
            replace("{deviceName}", _slots[DEVICE_NAME].value).
            replace("{dayOfWeek}", _slots.dayOfWeekFormatted.value).
            replace("{hourOfDay}", _slots.hourOfDayFormatted.value);
            try{
                var rampiotClient = new RampiotClient();
                var deviceInfo = RampiotDeviceFactory.getRampiotDeviceInfo(ctx.attributes.thing.type._id);
                deviceInfo.init(ctx.attributes.user, ctx.attributes.thing, ctx);
                /**
                 * Getting device possible scheduled actions:
                 * all possible scheduled actions are related to rules that will be evaluated with scheduled cron
                 */
                var pActions = deviceInfo.getPossibleActions();
                var actionCode = ctx.attributes.thing.possibleActions[_slots[ACTION].value];
                /**Getting selected scheduled action by action slot */
                var pAct = pActions.filter(function(ac){
                    return ac.code === actionCode;
                });
                var rule = pAct[0].rule;
                var fire = pAct[0].fire;
                var ruleIds = [];
                Logger.logDebug("Selected rule: "+JSON.stringify(rule));
                /**An scheduled action can be related with more that one rule */
                if( rule && rule instanceof Array ){
                    for( var i=0;i<rule.length;i++ ){
                        var _rule = rule[i];
                        try{
                            /**Creating specified rule for schedule action */
                            var resp = await( rampiotClient.createScheduledRule(
                                ctx.attributes.accessToken, ctx.attributes.thing._id, _rule
                            ));
                            rule._id = resp.id;
                            Logger.logDebug("Saved rule: "+JSON.stringify(rule));
                            ruleIds.push(resp.id);
                        }catch(exc){
                            /**Is possible that rule already exists, then service will return an 1028 error code and existent rule id*/
                            if( exc.code === 1028 ){
                                rule._id = exc.id;
                                Logger.logDebug("Already exists rule: "+JSON.stringify(rule));
                                ruleIds.push(exc.id);
                            }else{
                                Logger.logError(JSON.stringify(exc));
                                ctx.emit(':tellWithCard', ctx.t("GENERAL_ERROR_SCHEDULE_ACTION"), ctx.t("ERROR"), ctx.t("ERROR_SAVING")+" \n"+scheduledActionDescription);
                                ctx.emit(":responseReady");
                                return;
                            }
                        }
                    }                    
                    if( rule.length !== ruleIds.length ){
                        Logger.logDebug("Number of rules aren't equal to saved rules");
                        ctx.emit(':tellWithCard', ctx.t("GENERAL_ERROR_SCHEDULE_ACTION"), ctx.t("ERROR"), ctx.t("ERROR_SAVING")+" \n"+scheduledActionDescription);
                        ctx.emit(":responseReady");
                        return;                        
                    }
                }
                else if( rule ){
                    try{
                        /**Creating specified rule for schedule action */
                        var _resp = await( rampiotClient.createScheduledRule(
                            ctx.attributes.accessToken, ctx.attributes.thing._id, rule
                        ));
                        rule._id = _resp.id;
                        Logger.logDebug("Saved rule: "+JSON.stringify(rule));
                        ruleIds.push(_resp.id);
                    }catch(exc){
                        if( exc.code === 1028 ){
                            rule._id = exc.id;
                            Logger.logDebug("Already exists rule: "+JSON.stringify(rule));
                            ruleIds.push(exc.id);
                        }else{
                            Logger.logError(JSON.stringify(exc));
                            ctx.emit(':tellWithCard', ctx.t("GENERAL_ERROR_SCHEDULE_ACTION"), ctx.t("ERROR"), ctx.t("ERROR_SAVING")+" \n"+scheduledActionDescription);
                            ctx.emit(":responseReady");
                            return;
                        }
                    }
                }
                var jsonSchAction = ScheduledActionUtils.parseSlotsToJSONCronForScheduleAction(
                    scheduledActionDescription, _slots, ctx.t("RESTRICTED_DOW_SLOT_KV"), ruleIds, fire
                );
                Logger.logDebug("JSON-SCHEDULE_ACTION: "+JSON.stringify(jsonSchAction));
                await( rampiotClient.createScheduledAction(
                        ctx.attributes.accessToken, 
                        ctx.attributes.thing._id, 
                        jsonSchAction 
                ));
                var cardMessage = ctx.t("NEW_SCHEDULE_ACTION_CARD").
                replace("{action}", _slots[ACTION].value).
                replace("{deviceName}", _slots[DEVICE_NAME].value).
                replace("{dayOfWeek}", _slots.dayOfWeekFormatted.value).
                replace("{hourOfDay}", _slots.hourOfDayFormatted.value);
                var interjection = Utils.getRandomArrayItem(ctx.t("SUCCESS_INTERJECTIONS"));
                var endMessage = ctx.t("END_MESSAGE").replace("{interjection}", interjection);
                endMessage = endMessage.replace("{endPhrase}", Utils.getRandomArrayItem(ctx.t("SCHEDULER_END_PHRASES")));
                ctx.emit(':tellWithCard', endMessage, interjection, cardMessage);
                ctx.emit(":responseReady");
            }catch(exc){
                Logger.logError(exc);
                if( exc.code === 1040 ){
                    ctx.emit(':tellWithCard', ctx.t("SCHEDULED_ALREADY_EXISTS"), ctx.t("ERROR_ALREADY_EXISTS"), scheduledActionDescription);
                    ctx.emit(":responseReady");
                }else{
                    ctx.emit(':tellWithCard', ctx.t("GENERAL_ERROR_SCHEDULE_ACTION"), ctx.t("ERROR"), ctx.t("ERROR_SAVING")+" \n"+scheduledActionDescription);
                    ctx.emit(":responseReady");
                }
            }
        }else{
            ctx.response.speak(Utils.getRandomArrayItem(ctx.t("END_NO_CONFIRM_INTENT")));
            ctx.emit(':responseReady');
        }
    }
});