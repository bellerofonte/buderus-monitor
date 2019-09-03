const Server = require('./server');
const Config = require('./config.json');

new Server().run(Config);