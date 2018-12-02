
import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('modbus:ModbusSerial');


interface IModbusSerialConfig {
    device:  string;
    options: SerialPort.OpenOptions;
    timeoutMillis?: number;
}

import * as SerialPort from 'serialport';
import { sprintf } from 'sprintf-js';
import * as nconf from 'nconf';
import { ModbusAsciiFrame } from './modbus-ascii-frame';
import { ModbusRequestFactory, ModbusRequest, ModbusRequestError } from './modbus-request';


export class ModbusSerial {

    private _config: IModbusSerialConfig;
    private _serialPort: SerialPort;
    private _openPromise: { resolve: () => void, reject: (err: Error) => void};
    private _frame: string;
    private _receivedFrames: ModbusAsciiFrame [] = [];
    private _pending: IPendingRequest [] = [];

    public constructor (config?: IModbusSerialConfig) {
        this._config = config || nconf.get('modbus-serial');
        if (!this._config || !this._config.device || !this._config.options) { throw new Error('missing/wrong config'); }
        this._config.options.autoOpen = false;
        if (!(this._config.timeoutMillis > 0)) {
            this._config.timeoutMillis = 500;
        }
    }

    public async open () {
        if (this._openPromise) {
            return Promise.reject(new Error('open already called, execute close() first.'));
        }
        const rv: Promise<void> = new Promise<void>( (resolve, reject) => {
            this._serialPort = new SerialPort(this._config.device, this._config.options);
            // this._serialPort.on('open', this.handleOnSerialOpen.bind(this));
            this._serialPort.on('error', this.handleOnSerialError.bind(this));
            this._serialPort.on('data', this.handleOnSerialData.bind(this));
            this._openPromise = { resolve: resolve, reject: reject };
            this._serialPort.open( (err) => {
                if (!this._openPromise || !this._openPromise.resolve) { return; }
                if (err) {
                    debug.warn('cannot open serial port ' + this._config.device);
                    this._openPromise.reject(err);
                } else {
                    const o = Object.assign(this._config.options);
                    delete o.autoOpen;
                    debug.info('serial port ' + this._config.device + ' opened (' + JSON.stringify(o) + ')');
                    this._openPromise.resolve();
                }
                this._openPromise = null;
            });
        });
        return rv;
    }

    public async close () {
        if (!this._serialPort || !this._serialPort.isOpen) {
            return Promise.reject(new Error('serial port not open'));
        }
        if (this._openPromise && this._openPromise.reject) {
            this._openPromise.reject(new Error('serial port closed while opening pending'));
        }
        this._openPromise = null;
        try {
            await this._serialPort.close();
            debug.info('serial port ' + this._config.device + ' closed');
        } catch (err) {
            debug.warn('cannot close serial port ' + this._config.device, err);
        }
    }

    public async send (request: ModbusRequestFactory, timeoutMillis?: number): Promise<ModbusRequest> {
        if (!this._serialPort || this._openPromise) { throw new Error('serialPort not open'); }
        timeoutMillis = timeoutMillis || this._config.timeoutMillis;
        if (timeoutMillis <= 0) { throw new Error('invalid value for timeoutMillis'); }
        return new Promise<ModbusRequest>( (res, rej) => {
            const x: IPendingRequest = {
                requ: request,
                timer: null,
                timerModbus: null,
                resolve: res,
                reject: rej
            };
            const thiz = this;
            x.timer = setTimeout( () => {
                thiz.handleTimeout(x, false);
            }, timeoutMillis);
            this._pending.push(x);
            if (this._pending.length === 1) {
                this.write(this._pending[0]);
            }
        });
    }

    private handleTimeout (r: IPendingRequest, modbusTimeout: boolean) {
        if (r.timer && modbusTimeout) {
            clearTimeout(r.timer);
        }
        r.timer = null;
        if (r.timerModbus && !modbusTimeout) {
            clearTimeout(r.timerModbus);
        }
        r.timerModbus = null;

        let err: ModbusRequestError;
        if (modbusTimeout) {
            err = new ModbusRequestError('Modbus Timeout', r.requ);
        } else {
            err = new ModbusRequestError('Timeout', r.requ);
        }
        this.handleError(r, err);
    }

    private handleError (r: IPendingRequest, err: ModbusRequestError) {
        if (this._pending.length > 0) {
            this._pending.splice(0, 1);
            debug.finer('handleError(): removing pending request, length = %s', this._pending.length);
        }
        r.requ.error = err;
        if (r.timer) {
            clearTimeout(r.timer);
            r.timer = null;
        }
        if (r.timerModbus) {
            clearTimeout(r.timerModbus);
            r.timerModbus = null;
        }

        r.reject(err);
        if (this._pending.length > 0) {
            this.write(this._pending[0]);
        }
    }

    private write (r: IPendingRequest) {
        const thiz = this;
        process.nextTick( () => {
            this._serialPort.write(r.requ.request.frame, (err) => {
                if (err) {
                    this.handleError(r, new ModbusRequestError('serial interface error', err));
                } else {
                    if (debug.finest.enabled) {
                        debug.finest('pending length = %s', this._pending.length);
                        debug.finest('request written on serial interface (%o)', r.requ.request.buffer);
                    }
                    r.requ.sentAt = new Date();
                    r.timerModbus = setTimeout( () => {
                        debug.warn('Timeout %sms', Date.now() - r.requ.sentAt.getTime()) ;
                        thiz.handleTimeout(r, true);
                    }, 800);
                }
            });
        });
    }


    private handleOnSerialError (err: any) {
        debug.warn(err);
    }

    private handleOnSerialData (data: Buffer) {

        if (!(data instanceof Buffer)) {
            debug.warn('serial input not as expected...');
            return;
        }
        if (this._pending.length === 0) {
            debug.warn('unexpected bytes (no request pending) received (%o)', data);
        } else {
            for (const b of data) {
                const c = String.fromCharCode(b);
                if (c === ':') {
                    if (this._frame) {
                        debug.warn('unexpected start of frame, ignore recent bytes (%s)', this._frame);
                    }
                    this._frame = ':';
                } else if (c !== '\n') {
                    this._frame += c;
                } else {
                    this._frame += c;
                    if (debug.finest.enabled) {
                        debug.finest('receive Modbus ASCII frame %s bytes', this._frame.length);
                    }
                    let f: ModbusAsciiFrame;
                    let err: any;
                    try {  f = new ModbusAsciiFrame(this._frame); } catch (e) { err = err; }
                    this._frame = null;
                    if (!err && !f.lrcOk) {
                        err = new Error('LRC/CRC error on request');
                    }
                    const r = this._pending[0];
                    if (f) {
                        if (!r.requ.requestReceivedAt) {
                            try {
                                r.requ.requestReceived = f;
                                debug.finer('receive request (LRC %s) %o', f.lrcOk ? 'OK' : 'ERROR', f);
                            } catch (e) {
                                if (err) {
                                    debug.warn(err);
                                }
                                debug.warn('waiting for request, but receiving invalid frame\n%o\n%e', f, e);
                            }
                        } else {
                            r.requ.response = f;
                            debug.finer('receive response (LRC %s) %o', f.lrcOk ? 'OK' : 'ERROR', f);
                        }
                    }

                    if (err || r.requ.response) {
                        this._pending.splice(0, 1);
                        debug.finer('handleOnSerialData(): removing pending request -> length =%s', this._pending.length);
                        if (r.timer) {
                            clearTimeout(r.timer);
                            r.timer = null;
                        }
                        if (r.timerModbus) {
                            clearTimeout(r.timerModbus);
                            r.timerModbus = null;
                        }

                        if (err) {
                            const message = err && err.message ? ' (' + err.message + ')' : '';
                            r.requ.error = new ModbusRequestError('Modbus request fails' + message, r.requ, err);
                            r.reject(r.requ.error);
                        } else  {
                            r.resolve(r.requ);
                        }

                        if (this._pending.length > 0) {
                            this.write(this._pending[0]);
                        }
                    }
                }
            }
        }
    }

}

interface IPendingRequest {
    requ: ModbusRequestFactory;
    timer: NodeJS.Timer;
    timerModbus: NodeJS.Timer;
    resolve: (requ: ModbusRequest) => void;
    reject: (error: any) => void;
}
