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
const googleTrends = require('google-trends-api');
const host = "https://api.qwant.com/api/search/images?count=10&offset=1&q={0}&size=small";
const template = "<div class='cell'><img alt='{0}' src='{1}'/><p class='tag' type={2}>{3}</p></div>";

fs.readFile(filePath, {encoding: 'utf-8'}, function(err,data){
    if (!err) {
        $ = cheerio.load(data);
    } else {
        console.log(err);
    }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

app.get('/topic-suggest', function(req, res) {
	googleTrends.autoComplete({keyword: req.query.q}, function(err, results){
		if(err) {
			console.error('there was an error!', err);
			res.sendStatus(500);
		} else {
			console.log('my sweet sweet results', results);
			results = JSON.parse(results);
			console.log(results['default']);
			console.log(results['default'].topics);
			if (results && results.default && results.default.topics) {
				var topics = results.default.topics;
				res.json(topics);
				return;
			}
			res.json();
		}
	});
});

app.get('/all-images', function(req, res) {
	console.log("API called /all-images");
	new Promise(function(resolve, reject) {
		client.smembers("refreshed:sources", function(error, reply) {
			if (error) {
				res.sendStatus(500);
				reject(Error("Query sources failed"));
			}
			if (reply) {
				resolve(reply.map(function(source) {
					var object = {type:"source", query:source};
					return object;
				}));	
			}
		});
	}).then(function(response) {
		client.smembers("refreshed:topics", function(error, reply) {
			if (error) {
				res.sendStatus(500);
			}
			if (reply) {
				var arr = []
				var type = req.query.type;
				if (type == "topics") {
					arr = reply.map(function(topic) {
						var object = {type:"topic", query:topic};
						return object;
					});
				} else if (type == "sources") {
					arr = arr.concat(response);
				} else {
					arr = reply.map(function(topic) {
						var object = {type:"topic", query:topic};
						return object;
					});

					arr = arr.concat(response);
				}
				
				console.log("Totally " + arr.length+ " sources");
				Promise.all(arr.map(createTable)).then(function(resp) {
					var insertHtml="";
					for (var i = 0; i < resp.length; i++) {
						if (!resp[i] || !resp[i].query) {
							continue;
						}
						var sourceName = resp[i].query;
						var url = resp[i].imgUrl;
						var type = resp[i].type;
						insertHtml += template.format(sourceName, url, type, sourceName);
					}
					$("#holder").html(insertHtml);
					res.send($.html());
				}).catch(function(err) {
					console.log(err);
					res.sendStatus(500);
				});
				
			}
		});
	});
	
});

function createTable(query) {
	return new Promise(function(resolve, reject) {
		if (!query || !query.query) {
			resolve("");
		}
		if (query.type == "source") {
			client.get("refreshed:source:"+query.query.toLowerCase(), function(error, reply) {
				if (reply) {
					resolve({imgUrl:reply, type:query.type, query:query.query});
				} else {
					resolve("");
				}
					
			});
		} else if (query.type == "topic") {
			client.hgetall("refreshed:topic:"+query.query.toLowerCase(), function(error, reply) {
				if (reply) {
					resolve({imgUrl:reply.imgUrl, type:query.type, query:query.query});
				} else {
					resolve("");
				}
					
			});
		}
		
	});
}

app.post('/update-images',  function(req, res) {
	if (req.body) {
		var keycode = req.headers['x-api-key'];
		var source = req.body.source;
		var type = req.body.type;
		var url = req.body.url;
		if (!keycode || !source || !type || (type != "topic" && type != "source")) {
			res.status(400).send("Invalid request");
		}
		client.get("password", function(error, reply) {
			if (error) {
				res.sendStatus(500);
			}
			if (reply) {
				if (reply != keycode) {
					res.status(401).send("Invalid keycode");
				} else {
					if (type == "source") {
						client.set("refreshed:source:"+source.toLowerCase(), url, redis.print);
					} else if (type == "topic") {
						client.hset("refreshed:topic:"+source.toLowerCase(), "imgUrl", url, redis.print);
					}
					res.status(200).send("OK");
				}
			} else {
				res.status(401).send("Invalid keycode");
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

function queryRedis(query) {
	// return a new promise.
	return new Promise(function(resolve, reject) {
		
		var redisFunc = function(error, reply) {
			if (error) {
				resolve(jsonfy(query.query, ""));
			} else {
				if (reply === null || reply == "") {
					// Promise.resolve().
					const urlQwant = host.format(query.query);
					console.log(urlQwant);
					console.log("Query " + query.query + " from web")
					var options = {
						url: urlQwant,
						headers: {
							'User-Agent': 'request/1'
						}
					};
					request(options, function(error, response, body) {
						if (error || body === null || body === undefined) {
							console.log("Error in query " + error);
							addToRedis(query, "");
							resolve(jsonfy(query.query, ""));
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
								addToRedis(query, imgUrl);
								resolve(jsonfy(query.query, imgUrl));
							} else {
								addToRedis(query, "");
								console.log("Error no result in query " + body);
								resolve(jsonfy(query.query, ""));
							}
						} else {
							console.log("Error in upstream api " + body);
							addToRedis(query, "");
							resolve(jsonfy(query.query, ""));
						}
					});
				} else {
					console.log("Query " + query.query + " from Redis")
					var result = "";
					if (query.type == "source") {
						result = reply;
					} else if (query.type == "topic") {
						result = reply.imgUrl;
					}
					resolve(jsonfy(query.query, result));
				}
			}
		}
		var redisQuery = ""
		if (query.type == "source") {
			redisQuery = "refreshed:source:"+query.query.toLowerCase();
			client.get(redisQuery, redisFunc);
		} else if (query.type == "topic") {
			redisQuery = "refreshed:topic:"+query.query.toLowerCase();
			client.hgetall(redisQuery, redisFunc);
		}
	});
}

app.post('/update-topic',  function(req, res) {
	if (req.body) {
		var keycode = req.headers['x-api-key'];
		var topic = req.body.topic;
		var newsDays = req.body.newsDays;
		if (!keycode || !topic || !newsDays || newsDays == 0) {
			res.status(400).send("Invalid request");
		}
		client.get("password", function(error, reply) {
			if (error) {
				res.sendStatus(500);
			}
			if (reply) {
				if (reply != keycode) {
					res.status(401).send("Invalid keycode");
				} else {
					client.hset("refreshed:topic:"+topic.toLowerCase(), "newsDays", newsDays, redis.print);
					res.status(200).send("OK");
				}
			} else {
				res.status(401).send("Invalid keycode");
			}
		});
	} else {
		res.status(400).send("Invalid request");
	}
});

app.get('/topic-news-days', function(req, res) {
	if (req.query.q) {
		var query = req.query.q;
		client.hget("refreshed:topic:"+query.toLowerCase(), "newsDays", function(error, reply) {
			if (reply) {
				res.json({topic:query, newsDays:reply});
			} else {
				res.status(400).send("Invalid request");
			}
				
		});
	} else {
		res.status(400).send("Invalid request");
	}
});

function addToRedis(query, imgUrl) {
	// imgUrl may be "", so I may manually amend it later.
	var redisQuery = ""
	if (query.type == "source") {
		client.sadd("refreshed:sources", query.query.toLowerCase(), redis.print);
		client.set("refreshed:source:"+query.query.toLowerCase(), imgUrl, redis.print);
	} else if (query.type == "topic") {
		client.sadd("refreshed:topics", query.query.toLowerCase(), redis.print);
		client.hset("refreshed:topic:"+query.query.toLowerCase(), "imgUrl", imgUrl, redis.print);
	}
	
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
