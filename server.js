var request = require('request');
var redis = require('redis'),
	client = redis.createClient();
var multer = require('multer');
var upload = multer();
var express = require('express'),
	bodyParser = require('body-parser'),
		app = express(),
		port = 3002;
var fs = require('fs'),
    path = require('path'),    
    filePath = path.join(__dirname, 'table.html');
const cheerio = require('cheerio');
var $;
const host = "https://api.qwant.com/api/search/images?count=10&offset=1&q={0}&size=small";
const template = "<div class='cell'><img alt='{0}' src='{1}'/><p class='tag'>{2}</p></div>";

fs.readFile(filePath, {encoding: 'utf-8'}, function(err,data){
    if (!err) {
        $ = cheerio.load(data);
    } else {
        console.log(err);
    }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

app.get('/all-images', function(req, res) {
	console.log("API called /all-images");
	client.smembers("refreshed:sources", function(error, reply) {
		if (error) {
			res.sendStatus(500);
		}
		if (reply) {
			console.log("Totally " + reply.length+ " sources");
			Promise.all(reply.map(createTable)).then(function(resp) {
				var insertHtml="";
				console.log(resp);
				for (var i = 0; i < resp.length; i++) {
					var sourceName = reply[i];
					var url = resp[i];
					insertHtml += template.format(sourceName, url, sourceName);
				}
				$("#holder").html(insertHtml);
				console.log(reply);
				res.send($.html());
			}).catch(function(err) {
				console.log(err);
				res.sendStatus(500);
			});
			
		}
	});
});

function createTable(source) {
	return new Promise(function(resolve, reject) {
		client.get("refreshed:source:"+source.toLowerCase(), function(error, reply) {
			if (reply) {
				resolve(reply);
			} else {
				resolve("");
			}
				
		});
	});
}

app.post('/update-images',  function(req, res) {
	if (req.body) {
		var keycode = req.headers['x-api-key'];
		var source = req.body.source;
		var url = req.body.url;
		if (!keycode || !source) {
			res.status(400).send("Invalid request");
		}
		client.get("password", function(error, reply) {
			if (error) {
				res.sendStatus(500);
			}
			if (reply) {
				if (reply != keycode) {
					res.status(400).send("Invalid keycode");
				} else {
					client.set("refreshed:source:"+source.toLowerCase(), url, redis.print);
					res.status(200).send("OK");
				}
			} else {
				res.status(400).send("Invalid keycode");
			}
		});
	}
});

app.post('/images', upload.array(), function(req, res, next) {
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
		client.get("refreshed:source:"+source.toLowerCase(), function(error, reply) {
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
						if (error || body === null || body === undefined) {
							console.log("Error in query " + error);
							addToRedis(source, "");
							resolve(jsonfy(source, ""));
						}
						var json;
						try {
							json = JSON.parse(body);
						}
						catch (err) {
							console.log("Error in parse " + body);
						}
						if (json && json.status == "success" && !(json.data == undefined) && !(json.data.result == undefined)) {
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
	client.sadd("refreshed:sources", source.toLowerCase(), redis.print);
	client.set("refreshed:source:"+source.toLowerCase(), imgUrl, redis.print);
}

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-api-key");
  res.header("Access-Control-Allow-Methods", "POST, GET");
  next();
});

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
