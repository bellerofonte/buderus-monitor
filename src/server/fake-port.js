const EventEmitter = require('events');

module.exports = class extends EventEmitter {
    constructor() {
        super();
        this.state = {
            "Error": ['oops'],
            "TempOutdoor": "24.0",
            "Zone1": {
                "auto": true,
                "vacation": false,
                "summer": true,
                "day": true,
                "tempSet": "0.0",
                "tempReal": "26.5"
            },
            "Zone2": {
                "auto": true,
                "vacation": false,
                "summer": true,
                "day": true,
                "tempSet": "0.0",
                "tempReal": "24.5"
            },
            "Water": {
                "auto": false,
                "vacation": false,
                "summer": false,
                "day": false,
                "tempSet": "60.0",
                "tempReal": "51.0"
            }
        };
    }

    open() {
        if (!this.timer) {
            this.timer = setInterval(() => {
                this.emit('data', this.state);
            }, 10000);
        }
        return Promise.resolve();
    }
};


