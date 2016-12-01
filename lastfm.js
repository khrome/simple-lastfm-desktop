var Lastfm = require('simple-lastfm');
var exec = require('child_process').exec;
var crypto = require('crypto');
var http = require('http');
var xml2js = require('xml2js');
var fs = require('fs');

var Server = require('whammo');
var directorAdapter = require('whammo/routers/director');
var director = require('director');


function openAuthorization(ob, cb){
    var url = 'http://www.last.fm/api/auth/?api_key='+ob.api_key+'&token='+ob.token;
    exec('/usr/bin/open '+url);
    if(cb) cb();
}

function md5(string) {
	return crypto.createHash('md5').update(string, 'utf8').digest("hex");
}

Lastfm.prototype.ready = function(db, cb, focus){
    var lastFMAccount;
    var ob = this;
    var lookupAccountInfo = function(){
        db.query("SELECT * FROM accounts", function(err, result){
            if(err) return cb(err);
            var account = result.toArray()[0] || {};
            lastFMAccount = !err && {
                username : account.id,
                service : account.service,
                token : account.token
            };
            var application;
            if(lastFMAccount.token){
                ob.token = lastFMAccount.token;
                if(application) throw new Error('double called handle');
                ob.getDesktopSessionKey(function(result) {
                    if(result.success) {
                        if(cb) cb();
                    } else {
                        console.log("Error: " + result.error);
                    }
                }, function(done){
                    application = new Server();
                    directorAdapter.routeHTTP(application, new director.http.Router({
                        '/lastfm_return' : {
                            get:function(){
                                var uri = require('url').parse(this.req.url, true);
                                if(uri.query.token){
                                    ob.token = uri.query.token;
                                }
                                this.res.end(fs.readFileSync('lastfm.html'));
                                if(focus) focus();
                                application.stop();
                                done();
                            }
                        }
                    }));
                    application.listen(8082);
                    
                    openAuthorization(ob);
                });
            }else{
                ob.getToken(function(result){
                    //console.log("token = " + ob.token);
                    if(ob.token) {
                        var q = 'insert into accounts (id, service, token) values ("khrome", "lastfm", "'+ob.token+'") ';
                        db.query(q, function(err){
                            lookupAccountInfo();
                        });
                    } else {
                        console.log("Error: " + result.error);
                        if(cb) cb(result.error);
                    }
                });
            }
        });
    }
    lookupAccountInfo();
}

Lastfm.prototype.getDesktopSessionKey = function(callback, handleWebRedirect) {
	var sig = 'api_key' + this.api_key +'methodauth.getSessiontoken' + this.token + this.api_secret;
	var api_sig = md5(sig);
	var lastfmObj = this;
	var path = '/2.0/?method=auth.getSession&' +
		'token=' + this.token + '&' +
		'api_key=' + this.api_key + '&' +
		'api_sig=' + api_sig;
    console.log(path, sig);
    var ob = this;
	http.get({
		host: 'ws.audioscrobbler.com',
		port: 80,
		path: path
	}, function(res) {
		var body = '';
		res.on('data', function(chunk) {
			body += chunk;
		});
		res.on('end', function() {
			try {
				var parser = new xml2js.Parser(xml2js.defaults["0.1"]);
				parser.parseString(body, function(err, result) {
					var ret = {
						success: result['@'].status == 'ok'
					};
					if(ret.success){
						ret.session_key = result.session.key;
						lastfmObj.session_key = result.session.key;
						if(typeof callback == 'function') callback(ret);
					} else {
						ret.error = result.error['#'];
						if(ret.error.indexOf('token has not been authorized') !== -1){
						    return handleWebRedirect(function(){
						      ob.getDesktopSessionKey(callback, handleWebRedirect);
						    });
						}
					}
				});
			} catch(e) {
				if(lastfmObj.debug)
					console.log("Exception: ", e);
			}
		});
	});
};

Lastfm.prototype.getToken = function(callback) {
	var sig = 'api_key' + this.api_key + 'methodauth.getToken' + this.api_secret;
	var api_sig = md5(sig);
	var lastfmObj = this;
	http.get({
		host: 'ws.audioscrobbler.com',
		port: 80,
		path: '/2.0/?method=auth.getToken&' +
		'api_key=' + this.api_key + '&' +
		'api_sig=' + api_sig
	}, function(res) {
		var body = '';
		res.on('data', function(chunk) {
			body += chunk;
		});
		res.on('end', function() {
			try{
				var parser = new xml2js.Parser(xml2js.defaults["0.1"]);
				parser.parseString(body, function(err, result) {
					var ret = {
						success: result['@'].status == 'ok'
					};
					if(result.token) {
						lastfmObj.token = result.token;
					} else ret.error = result.error['#'];
					if(typeof callback == 'function') {
						try{
						callback(ret);
						} catch(e) {}
					}
				});
			}catch(e){
				var token = body.match(/<token>(.*?)<\/token>/)[1];
				if(token){
    				lastfmObj.token = token;
    				callback({success:'ok'});
				}else{
    				console.log("Exception: ", e);
                }
			}
		});
	});
};


module.exports = Lastfm;