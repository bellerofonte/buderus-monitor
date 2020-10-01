function _splitByNum(num, iterable) {
    let arr = [];
    for (let i = 0, j = iterable.length; i < j; i += num) {
        arr.push(iterable.slice(i, i + num));
    }
    return arr;
}

function _forceExit(err) {
    console.log(err);
    process.exit(1);
}

function wait(ms) {
    return new Promise(resolve => {
       setTimeout(resolve, ms);
    });
}

module.exports = class {
    constructor() {
        this.state = {};
        this.hasError = false;
    }

    run(config) {
        process.on('uncaughtException', err => {
            console.log('Caught exception: ' + err);
        });
        this._checkConfig(config)
            .then(() => this._runWebServer(config))
            .then(() => this._runTelegramBot(config))
            .then(() => this._runHistoryDB(config))
            .then(() => this._runMecPort(config))
            .catch(err => _forceExit(err));
    }

    _checkConfig(config) {
        return config ? Promise.resolve() : Promise.reject('Error: empty config');
    }

    _runMecPort(config) {
        const {portName} = config;
        if (!portName) {
            return Promise.reject('MEC2 port: port name is invalid');
        }
        const DEBUG = process.env.DEBUG;
        const Mec2Port = require(DEBUG === '1' ? './fake-port' : './mec2-port');
        this.port = new Mec2Port(portName);
        this.port.on('data', value => {
            const hadError = this.hasError;
            this.state = value;
            this.hasError = (value.Error.length > 0);
            if (this.hasError && !hadError) {
                this._sendWarning();
            }
            this.db && this.db.write(value);
        });
        return this.port.open().then(() => console.log('MEC2 port: on'));
    }

    _runWebServer(config) {
        const {web} = config;
        if (web) {
            const {allowedIP, port} = web;
            if (typeof port !== 'number') {
                return Promise.reject('Web server: port is invalid');
            }
            // create and run web-server
            process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
            const Express = require('express');
            const {IpFilter, IpDeniedError} = require('express-ipfilter');
            this.express = Express();
            if (allowedIP) {
                // Whitelist the following IPs
                this.express.use(IpFilter(allowedIP, {mode: 'allow', log: true, logLevel: 'deny'}));
                this.express.use((err, req, res, next) => {
                    if (err instanceof IpDeniedError) {
                        res.status(401).send('Get out!');
                    } else {
                        next(err);
                    }
                });
            }
            this.express.listen(port);
            this.express.get('/state', (req, res) => this._sendStatusWeb(res));
            this.express.get('/history', (req, res) => this._sendHistoryWeb(req, res));
            this.express.get('/', (req, res) => res.sendFile(__dirname + '/client/index.html'));
            this.express.get('/manifest.json', (req, res) => res.sendFile(__dirname + '/client/manifest.json'));
            this.express.get('/index.js', (req, res) => res.sendFile(__dirname + '/client/index.js'));
            this.express.get('/*.(ico|png)', (req, res) => res.sendFile(__dirname + '/client/icons' + req.url));
        }
        console.log(`Web server: ${this.express ? 'on' : 'off'}`);
        return Promise.resolve();
    }

    _runTelegramBot(config) {
        const {telegram} = config;
        //create Telegram Bot instance
        if (telegram) {
            const {apikey, proxy, phones} = telegram;
            if (!apikey) {
                return Promise.reject('Telegram bot: apikey is invalid');
            }
            if (!phones || !Array.isArray(phones) || phones.length === 0) {
                return Promise.reject('Telegram bot: no phones');
            }
            this.phones = phones;
            const TelegramBot = require('node-telegram-bot-api');
            const options = {
                polling: true,
                filepath: true,
                params: {timeout: 30}
            };
            if (proxy) {
                options.baseApiUrl = proxy;
            }
            this.bot = new TelegramBot(apikey, options);
            this.bot.on('message', msg => this._handleBotMessage(msg.chat.id, msg.text));
            this.bot.on('error', error => this._handleBotError('error', error));
            this.bot.on('polling_error', error => this._handleBotError('polling_error', error));
            // setup Telegram command handlers
            this.handlers = {
                'Status': (phone) => this._sendStatusBot(phone)
            };
            this.menuOptions = {
                parse_mode: 'Markdown',
                reply_markup: {
                    resize_keyboard: true,
                    keyboard: _splitByNum(3, Object.keys(this.handlers))
                }
            };
            this.botWdtTimeout = (telegram.max_timeout || 30) * 1000;
            this._startBotWdt();
        }
        console.log(`Telegram bot: ${this.bot ? 'on' : 'off'}`);
        return Promise.resolve();
    }

    _runHistoryDB(config) {
        const {db} = config;
        if (db) {
            const HistoryDB = require('./history-db');
            this.db = new HistoryDB(db);
            return this.db.run()
                .then(() => console.log('Database: on'));
        }
        console.log('Database: off');
        return Promise.resolve();
    }

    _sendWarning() {
        if (!this.bot) return;
        const msg = this.state.Error.join('\r\n');
        this.phones.forEach(p => {
            this.bot.sendMessage(p, msg, this.menuOptions);
        });
    }

    _handleBotMessage(phone, command) {
        if (!phone) return;
        if (this.phones.includes(phone)) {
            this._processHandler(phone, command) || this._processUnknown(phone);
        } else {
            console.log(`Unauthorized access from phone '${phone}'`);
            this.bot.sendMessage(phone, 'You shall not pass!')
                .catch(err => console.log(err));
        }
    }

    _botWdtCallback() {
        const last = this.bot._polling._lastUpdate;
        const now = (new Date()).getTime();
        if ((last > 0) && (now > (last + this.botWdtTimeout))) {
            console.log('Telegram bot WDT triggered. Trying to restart bot...');
            this._restartBot();
        }
    }

    _startBotWdt() {
        this.botWdt = setInterval(() => this._botWdtCallback(), 5000);
        return Promise.resolve();
    }

    _stopBotWdt() {
        if (this.botWdt) {
            clearTimeout(this.botWdt);
            this.botWdt = null;
        }
        return Promise.resolve();
    }

    _restartBot() {
        this.bot.stopPolling()                              // stop polling on error
            .then(() => {
                console.log('Telegram bot stopped');
                return this._stopBotWdt();
            })
            .then(() => wait(3000))                         // wait 3 seconds
            .then(() => {
                console.log('Trying to restart Telegram bot');
                this.bot.startPolling({restart: true});     // restart polling
            })
            .then(() => {
                console.log('Telegram bot restarted successfully');
                return this._startBotWdt();
            })
            .catch(e => console.log(e));                    // log error if failed
    }

    _handleBotError(src, error) {
        console.log(`TelegramBot stopped due to ${src}: ${error}`);
        this._restartBot();
    }

    _processHandler(phone, command) {
        const handler = this.handlers[command];
        if (handler) {
            this.bot.sendChatAction(phone, 'typing')
                .then(() => handler(phone))
                .catch(err => console.log(err));
            return true;
        }
        return false;
    }

    _processUnknown(phone) {
        this.bot.sendMessage(phone, 'try again', this.menuOptions)
            .catch(err => console.log(err));
        return true;
    }

    _sendStatusBot(phone) {
        const {TempOutdoor, Error, ...zones} = this.state;
        const lines = [];
        if (TempOutdoor) {
            lines.push(`*Outdoor: ${TempOutdoor}°C*`);
        }
        Object.keys(zones).forEach(key => {
            const {tempReal, tempSet, day, summer, auto, vacation} = zones[key];
            lines.push(`*${key}: ${tempReal}°C*/${tempSet}°C ${auto ? '\u{1F916}\u{fe0f}' : ''} ${day ? '☀\u{fe0f}' : '🌙\u{fe0f}'}${summer ? '⛱\u{fe0f}' : ''}${vacation ? ' ✈\u{fe0f}' : ''} `);
        });
        if (Error) {
            Error.forEach(e => lines.push(`🆘\u{fe0f}${e}`));
        }
        const msg = lines.join('\r\n');
        return this.bot.sendMessage(phone, msg || 'No data yet', this.menuOptions);
    }

    _sendStatusWeb(res) {
        return res.send(this.state);
    }

    _sendHistoryWeb(req, res) {
        if (this.db) {
            return this.db.read(req.query.period)
                .then(val => res.send(val || 'No data to show'))
                .catch(err => res.status(500).send({message: err.message || 'Invalid request'}));
        }
        return res.send('Database is currently off');
    }
};
