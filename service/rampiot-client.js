/* jshint node: true */
"use strict";

var request = require('request');
var Q = require('q');

module.exports.RampiotClient = function(){
    /* Get scheduleds list*/
    this.getScheduledActionsListsByThing = function(accessToken, thingId, callback){
        var endpoint = process.env.GET_SCHEDULEDS_LIST;
        endpoint = endpoint.replace(":id", thingId);
        var deferred = Q.defer();
        var options = {
            uri: endpoint,
            method: 'GET',
            headers:{
                'Authorization': accessToken
            }
        };    
        request(options, function (error, response, body) {
            var jsonBody = JSON.parse(body);
            if( error ){
                deferred.reject(error);
            }
            else if(response.statusCode === 200 ){
                deferred.resolve(
                    jsonBody && jsonBody.scheduleds && jsonBody.scheduleds.length > 0 ? jsonBody.scheduleds : []
                 );
            }else{
                deferred.reject(jsonBody);
            }
        });
        return deferred.promise.nodeify(callback);
    };
    /* Get user things*/
    this.getUserThings = function(accessToken, callback){        
        var deferred = Q.defer();
        var options = {
            uri: process.env.USER_THINGS_ENDPOINT,
            method: 'GET',
            headers:{
                'Authorization': accessToken
            }
        };    
        request(options, function (error, response, body) {
            var jsonBody = JSON.parse(body);
            if( error ){
                deferred.reject(error);
            }
            else if(response.statusCode === 200 ){
                deferred.resolve(jsonBody && jsonBody.things && jsonBody.things.length > 0 ? jsonBody.things : []);
            }else{
                deferred.reject(jsonBody);
            }
        });
        return deferred.promise.nodeify(callback);
    };
    /* Get thing by name*/
    this.getThingByName = function(accessToken, thingName, callback){
        var endpoint = process.env.THING_BY_NAME_ENDPOINT;
        endpoint = endpoint.replace(":name", thingName);
        var deferred = Q.defer();
        var options = {
            uri: endpoint,
            method: 'GET',
            headers:{
                'Authorization': accessToken
            }
        };    
        request(options, function (error, response, body) {
            var jsonBody = JSON.parse(body);
            if( error ){
                deferred.reject(error);
            }
            else if(response.statusCode === 200 ){
                deferred.resolve(
                    jsonBody && jsonBody.things && jsonBody.things.length > 0 ? jsonBody.things[0] : []
                 );
            }else{
                deferred.reject(jsonBody);
            }
        });
        return deferred.promise.nodeify(callback);
    };
    /* Create scheduled action*/
    this.createScheduledAction = function(accessToken, thingId, scheduledConf, callback){
        var endpoint = process.env.SCHEDULED_ACTION_ENDPOINT;
        endpoint = endpoint.replace(":id", thingId);
        var deferred = Q.defer();
        var options = {
            uri: endpoint,
            method: 'POST',
            headers:{
                'Authorization': accessToken
            },
            body: JSON.stringify(scheduledConf)
        };    
        request(options, function (error, response, body) {
            var jsonBody = JSON.parse(body);
            if( error ){
                deferred.reject(error);
            }
            else if(response.statusCode === 200 ){
                deferred.resolve(jsonBody);
            }else{
                deferred.reject(jsonBody);
            }
        });
        return deferred.promise.nodeify(callback);
    };
    /* Create rule*/
    this.createScheduledRule = function(accessToken, thingId, ruleDefinition, callback){
        var endpoint = process.env.NEW_RULE_ENDPOINT;
        endpoint = endpoint.replace(":id", thingId);
        var deferred = Q.defer();
        var options = {
            uri: endpoint+"?hidden=true",
            method: 'POST',
            headers:{
                'Authorization': accessToken
            },
            body: JSON.stringify({rule: ruleDefinition })
        };
        request(options, function (error, response, body) {
            var jsonBody = JSON.parse(body);
            if( error ){
                deferred.reject(error);
            }
            else if(response.statusCode === 200 ){
                deferred.resolve(jsonBody);
            }else{
                deferred.reject(jsonBody);
            }
        });
        return deferred.promise.nodeify(callback);
    };
    /* Create rule*/
    this.createRule = function(accessToken, thingId, ruleDefinition, callback){
        var endpoint = process.env.NEW_RULE_ENDPOINT;
        endpoint = endpoint.replace(":id", thingId);
        var deferred = Q.defer();
        var options = {
            uri: endpoint,
            method: 'POST',
            headers:{
                'Authorization': accessToken
            },
            body: JSON.stringify({rule: ruleDefinition })
        };
        request(options, function (error, response, body) {
            var jsonBody = JSON.parse(body);
            if( error ){
                deferred.reject(error);
            }
            else if(response.statusCode === 200 ){
                deferred.resolve(jsonBody);
            }else{
                deferred.reject(jsonBody);
            }
        });
        return deferred.promise.nodeify(callback);
    };
    /* Get things by token*/
    this.getThingsByToken = function(accessToken, callback){
        var deferred = Q.defer();
        var options = {
            uri: process.env.THINGS_ENDPOINT,
            method: 'GET',
            headers:{
                'Authorization': accessToken
            }
        };    
        request(options, function (error, response, body) {
            var jsonBody = JSON.parse(body);
            if( error ){
                deferred.reject(error);
            }
            else if(response.statusCode === 200 ){
                deferred.resolve(
                    jsonBody && jsonBody.things && jsonBody.things.length > 0 ? jsonBody.things : []
                 );
            }else{
                deferred.reject(jsonBody);
            }
        });
        return deferred.promise.nodeify(callback);
    };
    /* Getting thing owner info using access token*/
    this.getOwnerInfo = function(accessToken, callback){
        var deferred = Q.defer();
        var options = {
            uri: process.env.OWNER_INFO_ENDPOINT,
            method: 'GET',
            headers:{
                'Authorization': accessToken
            }
        };
        request(options, function (error, response, body) {
            var jsonBody = JSON.parse(body);
            if( error ){
                deferred.reject(error);
            }
            if(response.statusCode === 200 ){
                deferred.resolve(jsonBody);
            }else{
                deferred.reject(jsonBody);
            }
        });
        return deferred.promise.nodeify(callback);
    };
    /* Send command to thing*/
    this.sendCommand = function(accessToken, thingId, jsonCommand, callback){
        var endpoint = process.env.COMMAND_ENDPOINT;
        endpoint = endpoint.replace(":id", thingId);
        var deferred = Q.defer();
        var options = {
            uri: endpoint,
            method: 'POST',
            headers:{
                'Authorization': accessToken
            },
            body: JSON.stringify(jsonCommand)
        };
        request(options, function (error, response, body) {
            var jsonBody = JSON.parse(body);
            if( error ){
                deferred.reject(error);
            }
            if(response.statusCode === 200 ){
                deferred.resolve(jsonBody);
            }else{
                deferred.reject(jsonBody);
            }
        });
        return deferred.promise.nodeify(callback);
    };
};