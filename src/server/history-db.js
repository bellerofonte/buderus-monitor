const SQLite = require('sqlite3').verbose();
const Moment = require('moment');

module.exports = class {
    constructor(db) {
        this.db = new SQLite.Database(db.filename);
        this.interval = db.interval || 600000;
        this.table = `history${this.interval.toFixed(0)}`;
        this.fields = db.fields || ['outdoor', 'water', 'zone1', 'zone2'];
        this.getters = [() => this._getTimeD(new Date()), ...this.fields.map(f => this._createGetter(f))];
        this.current = null;
    }

    run() {
        return this._createTable()
            .then(() => this._createWriteStatement())
            .then(() => this._createReadStatement());
    }

    write(state) {
        return new Promise((resolve, reject) => {
            const values = this.current;
            this.current = this.getters.map(g => g(state));
            if (values && (this.current[0] > values[0])) {
                // if new time stamp exceeds prev time stamp + interval
                // we have to write old values to DB
                this.writeStmt.run(values, err => (err ? reject(err) : resolve()));
            } else {
                // otherwise - do nothing
                return Promise.resolve();
            }
        });
    }

    read(period) {
        return new Promise((resolve, reject) => {
            const now = Moment();
            let minTime = null;
            let divider = null;
            switch (period) {
                case '24h':
                    minTime = this._getTimeM(now.subtract(1, 'd'));
                    divider = 1;
                    break;
                case '1w':
                    minTime = this._getTimeM(now.subtract(7, 'd'));
                    divider = 6;
                    break;
                case '1m':
                    minTime = this._getTimeM(now.subtract(1, 'M'));
                    divider = 30;
                    break;
                case '3m':
                    minTime = this._getTimeM(now.subtract(3, 'M'));
                    divider = 90;
                    break;
                case '1y':
                    minTime = this._getTimeM(now.subtract(1, 'y'));
                    divider = 360;
                    break;
                default:
                    reject({message: 'Invalid period'});
                    return;
            }
            const modulo = this._getTimeM(now) % divider;
            this.readStmt.all([minTime, divider, modulo], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else if (rows && rows.length > 0) {
                        if (this.current) {
                            const row = {time: this.current[0]};
                            this.fields.forEach((f, i) => row[f] = this.current[i + 1]);
                            rows.push(row);
                        }
                        resolve({interval: this.interval, rows});
                    } else resolve(null);
                });
        });
    }

    _getTimeM(value) {
        return this._getTimeD(value.toDate());
    }

    _getTimeD(value) {
        return Math.floor(value.getTime() / this.interval);
    }

    _createGetter(field) {
        if (field === 'outdoor') {
            return (state) => {
                const temp = state.TempOutdoor;
                return (temp ? +temp : null);
            };
        } else {
            const zone = field[0].toUpperCase() + field.substring(1);
            return (state) => {
                const obj = state[zone];
                return (obj ? +(obj.tempReal) : null);
            };
        }
    }

    _createTable() {
        return new Promise((resolve, reject) => {
            const fields = this.fields.map(f => f + ' FLOAT').join(', ');
            const sql = `CREATE TABLE IF NOT EXISTS ${this.table} (time UNSIGNED BIG INT PRIMARY KEY, ${fields})`;
            console.log(`table: ${sql}`);
            this.db.run(sql, err => (err ? reject(err) : resolve()));
        });
    }

    _createWriteStatement() {
        return new Promise((resolve, reject) => {
            const fields = this.fields.map(() => '?').join(', ');
            const sql = `INSERT INTO ${this.table} VALUES (?, ${fields})`;
            console.log(`write: ${sql}`);
            this.writeStmt = this.db.prepare(sql, err => (err ? reject(err) : resolve()));
        });
    }

    _createReadStatement() {
        return new Promise((resolve, reject) => {
            const fields = this.fields.join(', ');
            const sql = `SELECT time, ${fields} FROM ${this.table} WHERE time > ? AND time % ? == ? ORDER BY time`;
            console.log(`read: ${sql}`);
            this.readStmt =
                this.db.prepare(sql, err => (err ? reject(err) : resolve()));
        });
    }
};
