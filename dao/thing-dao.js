/* jshint node: true */
"use strict";

var Q = require('q');
var AWS = require("aws-sdk");
var docClient = new AWS.DynamoDB.DocumentClient();

module.exports.ThingDAO = function(){
    /**Get previusly discovered things with alexa adapter */
    this.getDiscoveredThingsByUserId = function(userId, callback){
        var deferred = Q.defer();
        var params = {
            TableName: "Discovery",
            Key:{
                "owner": userId
            }
        };  
        docClient.get(params, function(err, data) {
            if( err ){
                deferred.reject(err);
            }else{
                deferred.resolve(data && data.Item && data.Item.things ? data.Item.things : []);
            }
        });
        return deferred.promise.nodeify(callback);
    };
};