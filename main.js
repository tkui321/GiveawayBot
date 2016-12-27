const {app, BrowserWindow, dialog, ipcMain, Tray, Menu, nativeImage, shell} = require('electron')
const request = require('request')
const notifier = require('node-notifier');
const player = require('play-sound')(opts = {})
const is = require('electron-is');

const POST_COUNT = 200;
const UPDATE_INTERVAL = 60;
const KEY_REGEX = /(key|giveaways?|serial|free|giving)/;
const UNFILTERED_SUBS = ["FreeGameFindings", "FreeGamesOnSteam", "Freegamestuff", "giveaway", "steam_giveaway", "pcgiveaways", "steamgiveaway", "RandomActsOfGaming"];
const TARGET_SUBS = ['FreeGameFindings', 'FreeGamesOnSteam', 'Freegamestuff', 'giveaway', 'steamgiveaway', 'steam_giveaway', 'RandomActsOfGaming', 'pcmasterrace', 'GiftofGames', 'randomactsofsteam', 'SecretSteamSanta', 'GiftOfGaben'];
const SUB_FILTERS = {
	default: [/\bkeys?\b/i, /\bredeems?\b/i, /\bgiving\b/i, /\bgiveaways?\b/i, /\bleftovers?\b/i, /\bcodes?\b/i, /\bserials?\b/i, /\b[a-zA-Z0-9]{5}\-[a-zA-Z0-9]{5}\-[a-zA-Z0-9]{5}\b/i, /\b[a-zA-Z0-9]{5}\-[a-zA-Z0-9]{5}\-[a-zA-Z0-9]{5}\-[a-zA-Z0-9]{5}\-[a-zA-Z0-9]{5}\b/i],
	GiftofGames: [/\[offer\]/i],
	RandomActsOfGaming: [/\[giveaway\]/i]
};


let tray, mainWindow, scannedList = [], filteredPosts = [];

function createWindow () {
	win = new BrowserWindow({width: 1050, height: 600})

	win.loadURL(`file://${__dirname}/index.html`)

	win.on('show', () => {
		tray.setHighlightMode('always')
	})
	win.on('hide', () => {
		tray.setHighlightMode('never')
	})

	win.on('closed', () => {

	})

	return win;
}

function toggleMainWindow(){
	if (!mainWindow || mainWindow.isDestroyed()){
		mainWindow = createWindow();
	}else{
		if (mainWindow.isMinimized())
			mainWindow.restore();
		else if (mainWindow.isVisible())
			mainWindow.close()
		else
			mainWindow.show();
	}
}

function pad(num, size) {
	var s = num + "";
	while (s.length < size) s = "0" + s;
	return s;
}

function log(arg){
	var date = new Date();

	console.log("["+pad(date.getHours(), 2)+":"+pad(date.getMinutes(), 2)+":"+pad(date.getSeconds(), 2)+"]:", arg)
}

function runScan(){
	log('Scanning...')
	var options = {
    	url     : 'http://www.reddit.com/r/' + TARGET_SUBS.join('+') + '/new/.json?limit='+POST_COUNT,
      	headers : {
        	'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:41.0) Gecko/20100101 Firefox/41.0',
      	},
      	method  : 'GET'
  	};

	request(options, function (err, res, body) {
	    if (err) {
	      	log(err);
	    } else {
	    	try{
		    	var posts = JSON.parse(body).data.children;

		    	var oldLength = filteredPosts.length;

		    	for (i in posts){
					var post = posts[i].data;

					isRelevant = false;

					if (scannedList.indexOf(post.id) != -1) continue;

					if (UNFILTERED_SUBS.indexOf(post.subreddit) != -1)
						isRelevant = true;
					else{
						var filters = SUB_FILTERS[post.subreddit] ? SUB_FILTERS[post.subreddit] : SUB_FILTERS['default'];
						for (i in filters)
							if (post.title.match(filters[i]) || (post.is_self && post.selftext.match(filters[i])))
								isRelevant = true;
					}

					if (isRelevant){
						filteredPosts.push(post); //push to 1st position

						if (is.windows()){
							tray.displayBalloon({
								icon: nativeImage.createFromPath(app.getAppPath() + '/images/icon.png'),
								title: "New hit!",
								content: post.title
							});
						}else{
							notifier.notify({
							  	title: 'New Hit',
							  	message: post.title,
							  	icon: app.getAppPath() + '/icon.png', // Absolute path (doesn't work on balloons)
							  	sound: true, // Only Notification Center or Windows Toasters
							  	wait: true // Wait with callback, until user action is taken against notification
							}, function (err, response) {
							  	// Response is response from notification
							});
						}
					}

					scannedList.push(post.id);
				}

				if (filteredPosts.length != oldLength)
					if (is.windows())
						shell.beep();
					else
						player.play("sounds/notify.ogg", (e) => {
							if (e) log(e);
						});

				if (mainWindow && !mainWindow.isDestroyed())
					mainWindow.webContents.send('scan-update', filteredPosts)
			}catch(e){
				log(e);
			}
	    }

	    log('Scan finnished, waiting ' + UPDATE_INTERVAL + ' seconds.')

		setTimeout(runScan, UPDATE_INTERVAL * 1000);
	});
}

app.on('ready', () => {
	tray = new Tray(app.getAppPath() + '/images/icon.png');

	tray.on('click', toggleMainWindow)

	const contextMenu = Menu.buildFromTemplate([
		{label: 'Show', click: toggleMainWindow},
		{label: 'Close', click: function() {
			app.quit();
		}}
	])

	tray.setToolTip('GiveawayBot engaged')

	tray.setContextMenu(contextMenu)

	runScan();

	ipcMain.on('error', function(e){
		console.log(e);
	});

	ipcMain.on("window-opened", () => {
		if (mainWindow && !mainWindow.isDestroyed())
			mainWindow.webContents.send('scan-update', filteredPosts);
	});

	toggleMainWindow();
});

app.on('window-all-closed', () => {})