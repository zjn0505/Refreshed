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
		client.get(source, function(error, reply) {
			if (error) {
				throw error;
			} else {
				if (reply === null) {
					// Promise.resolve().
					const urlQwant = host.format(source);
					console.log(urlQwant);
					var options = {
						url: urlQwant,
						headers: {
							'User-Agent': 'request/1'
						}
					};
					request(options, function(error, response, body) {
						if (error) {
							throw error;
						}
						var json = JSON.parse(body);
						if (json.status == "success" && !(json.data == undefined) && !(json.data.result == undefined)) {
							var result = json.data.result;
							if (!(result.items == null) && !(result.items == undefined) && result.items.length > 0) {
								// res.send(result.items[0].media);
								var imgUrl = result.items[0].media;
								console.log(imgUrl);
								client.sadd("refreshed:sources", source, redis.print);
								client.set(source, imgUrl, redis.print);
								resolve(jsonfy(source, imgUrl));
							} else {
								reject(body);
							}
						} else {
							reject(body);
						}
					});
				} else {
					resolve(jsonfy(source, reply));
				}
			}
		});
	});
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
