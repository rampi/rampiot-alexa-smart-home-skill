/* jshint node: true */
"use strict";

var durational = require("durational");
var RampiotDeviceFactory = require("./../rampiot-devices/rampiot-device-factory");
var Constants = require("./constants");
var Utils = require("./utils");

var wildCardDayOfWeek = ["forever", "all week", "everyday", "every day", "all days", "all"];

exports.getWildCardDOW = function(){
    return wildCardDayOfWeek;
}

var groupDays = {
    "weekend": [5,6], 
    "weekdays": [0,1,2,3,4]
};
var dowMap = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6
};

var toConditions = function(objDotNotated){
    var conditions = [];
    Object.keys(objDotNotated).forEach(function(key){
        var obj = {
            property: key,
            operator: "==",
            value: objDotNotated[key]
        };
        if( conditions.length > 1 ){
            obj.condOperator = "&&";
        }
        conditions.push(obj);
    });
    return conditions;
};

/**
 * See in i18n/messages.json the object:
 * RESTRICTED_DOW_SLOT_KV
 * This object allows to map words to word codes to facilitate the task of converting the slots into valid json for
 * for the scheduler web service. 
 * For example, this method converts "all days" word to *, but in another 
 * alexa supported langs "all days" is not a word, so, for mitigate this the object map for en_US:
 * "all days": "all days"
 * But when adds another lang like german, this map in de_DE must be:
 * "alle tage": "all days"
 * So, this method will can convert "alle tage" to "all days" and "all days" to *.
 * @param {*} ruleName
 * @param {*} slots 
 * @param {*} thingId 
 * @param {*} resourcesFunction 
 */
exports.parseSlotsToJSONRule = function(
    ruleName, slots, userId, thingId, 
    thingType, restrictedDowMap, profileEmail, 
    subjectPrefix, messageTemplate, pushMessageTemplate, 
    eventAction, possibleActionsToDoMap, possibleEvents
){
    var dowCode = restrictedDowMap[slots.dayOfWeek.value.toLowerCase()];
    var dow = wildCardDayOfWeek.indexOf(dowCode) >= 0 ? [0,1,2,3,4,5,6] : groupDays[dowCode] ? groupDays[dowCode] : [dowMap[dowCode]];
    var deviceInfo = RampiotDeviceFactory.getRampiotDeviceInfo(thingType);    
    var event = {
        status: deviceInfo.parseEvent(possibleEvents[slots.deviceEvent.value.toLowerCase()])
    };    
    var eventDotN = Utils.dotNotate(event);
    var conditions = toConditions(eventDotN);
    var connectedCondition = {
        property: "connected",
        operator: "==",
        value: true
    };
    if( conditions.length === 1 ){
        connectedCondition.condOperator = "&&";
    }
    conditions.push(connectedCondition);
    var startHArr = slots.startHour.value.split(":");
    var endHArr = slots.endHour.value.split(":");
    var restrictions = {
        dayOfWeek: dow,
        hoursRange: [
            {
                min: {
                    hours: parseInt(startHArr[0]),
                    minutes: parseInt(startHArr[1])
                },
                max: {
                    hours: parseInt(endHArr[0]),
                    minutes: parseInt(endHArr[1])
                }
            }
        ]
    };    
    var message = messageTemplate.replace("{deviceName}", slots.deviceName.value.toLowerCase()).
    replace("{deviceEvent}", slots.deviceEvent.value.toLowerCase()).
    replace("{actionToDo}", slots.actionToDo.value.toLowerCase());
    var pushMessage = pushMessageTemplate.replace("{deviceName}", slots.deviceName.value.toLowerCase()).
    replace("{deviceEvent}", slots.deviceEvent.value.toLowerCase()).
    replace("{actionToDo}", slots.actionToDo.value.toLowerCase());
    var PUSH_NOTIFICATION = {
        name: "PUSH_NOTIFICATION",
        content:{
            title: subjectPrefix+" "+slots.deviceName.value.toLowerCase(),
            message: pushMessage
        }
    };
    var EMAIL = {
        name: "EMAIL",
        content:{
            to: profileEmail,
            subject: subjectPrefix+" "+slots.deviceName.value.toLowerCase(),
            message: message
        }
    };  
    var THING_ACTION = {};  
    /**By default, only send notification */
    var pAction = {
        value: Constants.CODE_SEND_NOTIFICATION
    };
    if( possibleActionsToDoMap && possibleActionsToDoMap.length > 0 ){
        var opt = possibleActionsToDoMap.filter(function(item){
            return item.key.toLowerCase() === slots.actionToDo.value.toLowerCase();
        });
        pAction = opt[0];
    }
    if( pAction.value === Constants.CODE_DEVICE_ACTION || 
        pAction.value === Constants.CODE_DEVICE_ACTION_AND_NOTIFY ){
        THING_ACTION = {
            name: "THING_EVENT",
            content:{
                profile: {
                    userId: userId
                },
                actionEvents: [{
                    thing: {
                        _id: thingId,
                        status: deviceInfo.parseEvent(eventAction)
                    },
                    fireUserId: "RULE"
                }]                
            }
        };
    }
    var actions = [];    
    switch( pAction.value ){
        case Constants.CODE_SEND_NOTIFICATION:
            actions.push(EMAIL);
            actions.push(PUSH_NOTIFICATION);
        break;
        case Constants.CODE_DEVICE_ACTION:
            actions.push(THING_ACTION);
        break;
        case Constants.CODE_DEVICE_ACTION_AND_NOTIFY:
            actions.push(EMAIL);
            actions.push(PUSH_NOTIFICATION);
            actions.push(THING_ACTION);
        break;
    }
    var ruleObj = {
        name: ruleName,
        conditions: conditions,
        restrictions: restrictions,
        actions: actions
    };
    if( slots.delayTime && slots.delayTime.value ){
        ruleObj.timerWatchValue = durational.fromString(slots.delayTime.value);
    }
    return ruleObj;
};