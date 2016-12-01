# simple-lastfm-desktop

**Desktop Hooks for lastfm integrations**

You are here because you are building an app(probably with [Electron](http://electron.atom.io)) which integrates to lastfm, but using the desktop integration flow with any of the existing npm libraries kind of sucks.

So here's extensions to [simple-lastfm](https://www.npmjs.com/package/simple-lastfm) to support desktop authentication methods, as well as a conveinience method to handle the whole process.

## account configuration

Make sure when you create your last.fm account you set your domain to localhost, so your application can open a port and the web browser can deliver the token to your app. The `.ready()` wrapup function uses `http://localhost:8082/lastfm_return`, so you should use that. If you are manually using `.getDesktopSessionKey()` and `.getToken()` you can use whatever you want (like something more complicated requiring a server).

## desktop authentication methods

- `api.getToken(<callback(result)>)` calls with an object containing `.status` and `.token` or `.error` and requires `.api_key` and `.api_secret` are set
- `api.getDesktopSessionKey(<callback(result)>, <authenticate(finishFunction)>)` calls with an object containing `.status` and `.token` or `.error` and requires `.token`, `.api_key` and `.api_secret` are set. 

To authenticate you need to open a server which can recieve the notification, then forward the user to the last.fm authentication endpoint( `http://www.last.fm/api/auth/?api_key=<api key>&token=<token>` ), after authenticating the app they will redirect to the URL you set when you obtain the key. If you want a host free setup, then use localhost and the website can notify your local webserver (this is automated in `.ready()` below).

## .ready() ... the short, short version

`.ready(<readyFunction>, <authenticationCompleteFunction>)`

So, this requires a sql compatible database. I'm going to show how to use it with [Mangrove](https://www.npmjs.com/package/mangrove), but you could also use anything that supports sql (just pass an object with a `.query(<sql>, <callback>)` signature). This will direct the user through last.fm's authentication flow in their default browser and return them to the application when complete (some browsers will not allow me to close the resulting window!). I'm using the `fs` sync functions just for brevity and the process requires **port 8082** be available. When using this in your own project copy `lastfm.html` into your own app (this is the page served to users when they return from last.fm).


	var db = new Mangrove(fs.readFileSync('services.json'))

	api.ready(db, function(){
        //api is now ready to be used
    }, function(){
    	//switch back to the app window after auth in the browser
        window.show();
    });
    
    
Then, when the application is closing:

	fs.writeFileSync('services.json', db.toJSON())
	
That was as simple as I could make it, and really... that's not too bad.

Enjoy,

-Abbey Hawk Sparrow