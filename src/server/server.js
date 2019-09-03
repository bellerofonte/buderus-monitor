process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
const DEBUG = process.env.DEBUG;
const TelegramBot = require('node-telegram-bot-api');
const Mec2Port = require(DEBUG === '1' ? './fake-port' : './mec2-port');
const Express = require('express');
const {IpFilter, IpDeniedError} = require('express-ipfilter');

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

const HistoryInterval = 600000; // 10 minutes in milliseconds

module.exports = class {
    constructor() {
        this.state = {};
        this.hasError = false;
        this.history = [];
    }

    run(config) {
        process.on('uncaughtException', err => {
            console.log('Caught exception: ' + err);
        });
        this._runMecPort(config)
            .then(() => this._runWebServer(config))
            .then(() => this._runTelegramBot(config))
            .catch(err => _forceExit(err));
    }

    _runMecPort(config) {
        const {portName} = config;
        if (!portName) {
            return Promise.reject('MEC2 port: port name is invalid');
        }
        this.port = new Mec2Port(portName);
        this.port.on('data', value => {
            const hadError = this.hasError;
            this.state = value;
            this.hasError = (value.Error.length > 0);
            if (this.hasError && !hadError) {
                this._sendWarning();
            }
        });
        return this.port.open();
    }

    _runWebServer(config) {
        const {web} = config;
        if (web) {
            const {allowedIP, port} = web;
            if (typeof port !== 'number') {
                return Promise.reject('Web server: port is invalid');
            }
            // create and run web-server
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
            this.express.get('/history', (req, res) => this._sendHistoryWeb(res));
            this.express.get('/', (req, res) => res.sendFile(__dirname + '/client/index.html'));
            this.express.get('/manifest.json', (req, res) => res.sendFile(__dirname + '/client/manifest.json'));
            this.express.get('/index.js', (req, res) => res.sendFile(__dirname + '/client/index.js'));
            this.express.get('/*.(ico|png)', (req, res) => res.sendFile(__dirname + '/client/icons' + req.url));
        }
        console.log(`Web server: ${this.express ? 'on' : 'off'}`);
        return Promise.resolve('OK');
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
            const opts =  proxy ? {baseApiUrl: proxy} : {};
            this.phones = phones;
            this.bot = new TelegramBot(apikey, {polling: true, filepath: true, ...opts});
            this.bot.on('message', msg => this._handleBotMessage(msg.chat.id, msg.text));
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
        }
        console.log(`Telegram bot: ${this.bot ? 'on' : 'off'}`);
        return Promise.resolve('OK');
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
        }
        else {
            console.log(`Unauthorized access from phone '${phone}'`);
            this.bot.sendMessage(phone, 'You shall not pass!')
                .catch(err => console.log(err));
        }
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
            lines.push(`*${key}: ${tempReal}°C*/${tempSet}°C ${auto ? 'auto' : ''} ${day ? '\☀\u{fe0f}' : '🌙\u{fe0f}'}${summer ? '⛱\u{fe0f}' : ''}${vacation ? ' ✈\u{fe0f}' : ''} `);
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

    _sendHistoryWeb(res) {
        return res.send(this.history);
    }
    
    _getHistoryItem() {
        const time = Math.floor(Date.now() / HistoryInterval);
        if (this.history.length > 0) {
            const item = this.history[this.history.length - 1];
            if (time === item.time) {
                return item;
            }
        }
        const item = { time };
        this.history.push(item);
        return item;
    }
};
