const Mec2Port = require('serialport');
const EventEmitter = require('events');

const BUFSIZE = 256;
const bits = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80];

function hasBit(value, bit) {
    const flag = bits[bit];
    return (value & flag) === flag;
}

module.exports = class extends EventEmitter {
    constructor(portName) {
        super();
        const port = new Mec2Port(portName, {
            baudRate: 1200,
            autoOpen: false
        });

        // Handle error event
        port.on('error', err => {
            console.log('Error: ', err.message);
        });

        // Switches the port into "flowing mode"
        port.on('data', data => {
            this.handleData(data);
        });

        this.port = port;
        this.buffer = Buffer.alloc(BUFSIZE, 0x0);
        this.online = false;
        this.count = 0;
        this.state = {
            Error: []
        };
    }

    open() {
        return new Promise((resolve, reject) => {
            this.port.open(err => (err ? reject(err) : resolve()));
        });
    }

    handleData(data) {
        if (this.count + data.length <= BUFSIZE) {
            data.copy(this.buffer, this.count);
            this.count += data.length;
            //console.log(this.buffer.toString('hex', 0, this.count));
            const c1 = Math.floor(this.buffer[this.count - 1] / 0x10);
            const c2 = this.buffer[this.count - 2];
            if (c2 === 0xaf && (c1 === 0x8 || c1 === 0x0)) {
                // end of frame
                if (this.count === 11 && this.online) {
                    // this.emit('message', {buffer: this.buffer, length: this.count});
                    // determine event type and parse message
                    switch (this.buffer[0]) {
                        case 0x80:
                        case 0x81:
                        case 0x82:
                        case 0x83:
                            this.parseZone(this.buffer[0] - 0x7F);
                            break;
                        case 0x84:
                            this.parseWater();
                            break;
                        case 0x88:
                            this.parseBoiler1();
                            break;
                        case 0x89:
                            this.parseBoiler2();
                            break;
                    }
                }
                this.count = 0;
                this.online = true;
            }
        }
    }

    parseZone(idx) {
        switch (this.buffer[1]) {
            case 0x00:
                const b0 = this.buffer[2];
                const b1 = this.buffer[3];
                this.assignState(`Zone${idx}`, {
                    // working values #1
                    auto: hasBit(b0, 3),
                    vacation: hasBit(b0, 6),
                    // working values #2
                    summer: hasBit(b1, 1),
                    day: hasBit(b1, 2),
                    tempSet: (this.buffer[6] * 0.5).toFixed(1), // because it has step 0.5 degree
                    tempReal: (this.buffer[7] * 0.5).toFixed(1) // because it has step 0.5 degree
                });
                break;
            // case 0x06:
            //     break;
            // case 0x0c:
            //     break;
            default:
                return; // smth gone wrong
        }
    }

    parseWater() {
        switch (this.buffer[1]) {
            case 0x00:
                const b0 = this.buffer[2];
                const b1 = this.buffer[3];
                this.assignState('Water', {
                    auto: hasBit(b0, 0x1),
                    vacation: hasBit(b0, 0x08),
                    summer: hasBit(b1, 0x1),
                    day: hasBit(b1, 0x2),
                    tempSet: this.buffer[4].toFixed(1),
                    tempReal: this.buffer[5].toFixed(1)
                });
                const error = this.state.Error;
                error.splice(0, error.length);
                if (hasBit(b0, 5)) {
                    error.push('disinfection');
                }
                if (hasBit(b0, 6)) {
                    error.push('sensor');
                }
                if (hasBit(b0, 7)) {
                    error.push('water stays cold');
                }
                if (hasBit(b0, 8)) {
                    error.push('anode');
                }
                break;
            // case 0x06:
            //     break;
            // case 0x0c:
            //     break;
            default: return; // smth gone wrong
        }
    }

    parseBoiler1() {
        switch (this.buffer[1]) {
            // case 0x00:
            //     break;
            case 0x06:
                const b0 = this.buffer[2];
                const error = this.state.Error;
                if (hasBit(b0, 1)) {
                    error.push('burner failure');
                }
                if (hasBit(b0, 2)) {
                    error.push('primary sensor failure');
                }
                if (hasBit(b0, 3)) {
                    error.push('secondary sensor failure');
                }
                if (hasBit(b0, 4)) {
                    error.push('boiler stays cold');
                }
                if (hasBit(b0, 5)) {
                    error.push('exhaust sensor failure');
                }
                if (hasBit(b0, 6)) {
                    error.push('exhaust is over limit');
                }
                if (hasBit(b0, 7)) {
                    error.push('safety chain triggered');
                }
                if (hasBit(b0, 8)) {
                    error.push('external error');
                }
                break;
            // case 0x0c:
            //     break;
            default: return; // smth gone wrong
        }
    }

    parseBoiler2() {
        switch (this.buffer[1]) {
            case 0x00:
                const b0 = this.buffer[2];
                this.state.TempOutdoor = (b0 <= 127 ? b0 : -(256 - b0)).toFixed(1);
                break;
            // case 0x06:
            //     break;
            case 0x0c:
                // this is the end of event cycle
                // it's time to notify event listeners
                this.emit('data', this.state);
                break;
            default: return; // smth gone wrong
        }
    }

    assignState(name, value) {
        this.state[name] = Object.assign(this.state[name] || {}, value);
    }
};