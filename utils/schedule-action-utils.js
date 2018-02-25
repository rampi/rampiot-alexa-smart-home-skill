/* jshint node: true */
"use strict";

var wildCardDayOfWeek = ["forever", "all week", "everyday", "every day", "all days", "all"];

exports.getWildCardDOW = function(){
    return wildCardDayOfWeek;
}

var groupDays = {
    "weekend": "6,7", 
    "weekdays": "1,2,3,4,5"
};
var dowMap = {
    "monday": "1",
    "tuesday": "2",
    "wednesday": "3",
    "thursday": "4",
    "friday": "5",
    "saturday": "6",
    "sunday": "7"
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
 */
exports.parseSlotsToJSONCronForScheduleAction = function(
    scheduledName, slots, restrictedDowMap, ruleIds, fire
){
    var dowCode = restrictedDowMap[slots.dayOfWeek.value.toLowerCase()];
    var dow = wildCardDayOfWeek.indexOf(dowCode) >= 0 ? "*" : groupDays[dowCode] ? groupDays[dowCode] : dowMap[dowCode];
    var hoursOfDayArr = slots.hourOfDay.value.split(":");
    var hours = parseInt(hoursOfDayArr[0]);
    var minutes = parseInt(hoursOfDayArr[1]);
    var ruleDef = {
        name: scheduledName,
        config:{
            minutes: String(minutes),
            hours: String(hours),
            dow: String(dow),
            dom: "*",
            mon: "*",
            year: "*"
        }        
    };
    if( ruleIds && ruleIds.length > 0 ){
        ruleDef.rules = ruleIds;
    }
    else if( fire ){
        ruleDef.fire = fire;
    }
    return ruleDef;
};