var request = require('request');
var redis = require('redis'),
	client = redis.createClient();
var multer = require('multer');
var upload = multer();
var express = require('express'),
	bodyParser = require('body-parser'),
		app = express(),
		port = 3002;
const host = "https://api.qwant.com/api/search/images?count=10&offset=1&q={0}&size=small";

app.use(bodyParser.json());

app.post('/images', upload.array(), function (req, res, next) {
	console.log(req.body);
	var images = [];
	images = images.concat(req.body);

	Promise.all(images.map(queryRedis)).then(function(resp) {
		console.log(resp);
		var obj = new Object();
		obj.size = resp.length;
		obj.data = resp;
		res.json(obj);
	}).catch(function(err) {
		console.log(err);
		res.sendStatus(500);
	});
});

function queryRedis(source) {
	// return a new promise.
	return new Promise(function(resolve, reject) {
		client.get("refreshed:source:"+source, function(error, reply) {
			if (error) {
				resolve(jsonfy(source, ""));
			} else {
				if (reply === null || reply == "") {
					// Promise.resolve().
					const urlQwant = host.format(source);
					console.log(urlQwant);
					console.log("Query " + source + " from web")
					var options = {
						url: urlQwant,
						headers: {
							'User-Agent': 'request/1'
						}
					};
					request(options, function(error, response, body) {
						if (error) {
							console.log("Error in query " + error);
							addToRedis(source, "");
							resolve(jsonfy(source, ""));
						}
						var json = JSON.parse(body);
						if (json.status == "success" && !(json.data == undefined) && !(json.data.result == undefined)) {
							var result = json.data.result;
							if (!(result.items == null) && !(result.items == undefined) && result.items.length > 0) {
								var imgUrl = result.items[0].media;
								console.log(imgUrl);
								addToRedis(source, imgUrl);
								resolve(jsonfy(source, imgUrl));
							} else {
								addToRedis(source, "");
								console.log("Error no result in query " + body);
								resolve(jsonfy(source, ""));
							}
						} else {
							console.log("Error in upstream api " + body);
							addToRedis(source, "");
							resolve(jsonfy(source, ""));
						}
					});
				} else {
					console.log("Query " + source + " from Redis")
					resolve(jsonfy(source, reply));
				}
			}
		});
	});
}


function addToRedis(source, imgUrl) {
	// imgUrl may be "", so I may manually amend it later.
	client.sadd("refreshed:sources", source, redis.print);
	client.set("refreshed:source:"+source, imgUrl, redis.print);
}

app.listen(port);


function jsonfy(source, imgUrl) {
	var obj = new Object();
	obj.source = source;
	obj.imgUrl = imgUrl;
	return obj
}

String.prototype.format = function() {
    var formatted = this;
    for( var arg in arguments ) {
        formatted = formatted.replace("{" + arg + "}", arguments[arg]);
    }
    return formatted;
};
