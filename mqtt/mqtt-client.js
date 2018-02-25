var mqtt = require('mqtt');
var config = require("./../config/configuration.json");

exports.subscribe = function(topic, token, callback, onConnect){
	var client  = mqtt.connect({
		host: config.mqttHost,
		port: config.mqttPort,
		username: token
	});
	client.on('connect', function () {
		client.subscribe(topic, {qos: 2},
		function(e,r){
            if( e ){
                callback(e,r);
            }else{
				if( onConnect ){
					onConnect(e,r);
				}				
			}	
		});
	}).
	on('error', function (err) {
		callback(err);
    }).
    on("message", function (topic, payload) {
        callback(null, JSON.parse(payload.toString()));
        client.end();
    });
};