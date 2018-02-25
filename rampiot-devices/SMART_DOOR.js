/* jshint node: true */
"use strict";

var userProfile = null;
var currentThing = null;
var skillContext = null;

/*
*    Map 1 to 1 relation for event actions, for example, if when user creates a rule for smart door 
*    he can choose that door lock after close event.
*/
var eventActionMap = {
    "close": "lock",
    "closed_unlocked": "lock"
};

exports.init = function(uProfile, thing, ctx){
    userProfile = uProfile;
    currentThing = thing;
    skillContext = ctx;
};

/*
    Possible events in rampiot platform, locked, unlocked, open and closed
*/
exports.getPossibleEvents = function(){
    return ["lock", "unlock", "open", "close"];
};

/*
    Possible scheduled actions 
*/
exports.getPossibleActions = function(){
    return [
        {
            "code": "lock",
            "fire":{
                "status":{
                    "event":"lock"
                }
            }
        },
        {
            "code": "unlock",
            "fire":{
                "status":{
                    "event":"unlock"
                }
            }
        },
        {
            "code": "security_check",
            "rule":[{
                "name": "Notify if is open",
                "conditions": [
                    {
                        "property": "connected",
                        "operator": "==",
                        "value": true
                    },
                    {
                        "condOperator": "&&",
                        "property": "status.state",
                        "operator": "==",
                        "value": "opened"
                    }
                ],
                "actions":[
		    {
                        "name": "PUSH_NOTIFICATION",
                        "content":{
                            "title": skillContext.t("SECUTITY_CHECK_EMAIL_SUBJECT").replace("{deviceName}", currentThing.name),
                            "message": skillContext.t("SECUTITY_CHECK_EMAIL_IS_OPEN").replace("{deviceName}", currentThing.name)
                        }
                    },
                    {
                        "name": "EMAIL",
                        "content":{
                            "to": userProfile.email,
                            "subject": skillContext.t("SECUTITY_CHECK_EMAIL_SUBJECT").replace("{deviceName}", currentThing.name),
                            "message": skillContext.t("SECUTITY_CHECK_EMAIL_IS_OPEN").replace("{deviceName}", currentThing.name)
                        }
                    }
                ]
            },
            {
                "name": "Lock if is closed",
                "conditions": [                    
                    {
                        "property": "connected",
                        "operator": "==",
                        "value": true
                    },
                    {
                        "condOperator": "&&",
                        "property": "status.state",
                        "operator": "==",
                        "value": "closed_unlocked"
                    }
                ],
                "actions":[
                    {
                        "name": "THING_EVENT",
                        "content":{
                            "profile": {
                                "userId": userProfile.userId
                            },
                            "actionEvents": [{
                                "thing": {
                                    "_id": currentThing._id,
                                    "status": {
                                        "event": "lock"
                                    }
                                },
                                "fireUserId": "SCHEDULED_RULE"
                            }]                
                        }
                    }
                ]
            }]
        }       
    ];
};

exports.parseEvent = function(action, params){
    switch( action ){
        case "close":
            return {
                "event": "close"
            };
        case "open":
            return {
                "event": "open"
            };        
        case "lock":
            return {
                "event": "lock"
            };
        case "unlock":
            return {
                "event": "unlock"
            };        
        case "pin_unlock":
            return {
                "event": "pin_unlock",
                "pin": parseInt(params.pin)
            };
        default:
            throw "Action not supported";

    }
};

exports.mapEventAction = function(){
    return eventActionMap;
};

exports.getActionFromEvent = function(event){
    return eventActionMap[event];
};

exports.requiresDelay = function(event){
    return ["open", "close"].indexOf(event) >= 0;
};

exports.getDeviceStatus = function(status){
    switch( status.state ){
        case "closed_unlocked":
            return "closed_unlocked";
        case "closed_locked":
            return "closed_locked";
        case "opened":
            return "opened";
    }
};
