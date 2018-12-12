
import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('modbus:ModbusSerial');


export interface IModbusSerialConfig {
    disabled?: boolean;
    device:  string;
    options: SerialPort.OpenOptions;
}

import * as SerialPort from 'serialport';
import { sprintf } from 'sprintf-js';
import * as nconf from 'nconf';
import { ModbusAsciiFrame } from './modbus-ascii-frame';
import { ModbusRequestFactory, ModbusRequest, ModbusRequestError } from './modbus-request';
import { IModbusSerialDeviceConfig, ModbusSerialDevice } from './modbus-serial-device';
import { Gpio } from './gpio';


export class ModbusSerial {

    private _config: IModbusSerialConfig;
    private _devices: ModbusSerialDevice [];
    private _serialPort: SerialPort;
    private _receive: { frames: boolean, chars: boolean } = { frames: false, chars: false };
    private _openPromise: { resolve: () => void, reject: (err: Error) => void};
    private _frame: string;
    private _receivedChars: string;
    private _pending: IPendingRequest [] = [];
    private _errCnt = 0;

    public constructor (config?: IModbusSerialConfig) {
        this._config = config || nconf.get('modbus-serial');
        if (!this._config || !this._config.device || !this._config.options) { throw new Error('missing/wrong config'); }
        this._config.options.autoOpen = false;
    }

    public get config (): IModbusSerialConfig {
        return this._config;
    }

    public get device (): string {
        return this._config.device;
    }

    public async open (devices?: ModbusSerialDevice []) {
        if (this._openPromise) {
            return Promise.reject(new Error('open already called, execute close() first.'));
        }
        const rv: Promise<void> = new Promise<void>( (resolve, reject) => {
            this._serialPort = new SerialPort(this._config.device, this._config.options);
            // this._serialPort.on('open', this.handleOnSerialOpen.bind(this));
            this._serialPort.on('error', this.handleOnSerialError.bind(this));
            this._serialPort.on('data', this.handleOnSerialData.bind(this));
            this._openPromise = { resolve: resolve, reject: reject };
            this._receive.chars = false;
            this._receive.frames = false;
            this._serialPort.open( (err) => {
                if (!this._openPromise || !this._openPromise.resolve) { return; }
                if (err) {
                    debug.warn('cannot open serial port ' + this._config.device);
                    this._openPromise.reject(err);
                } else {
                    const o = Object.assign(this._config.options);
                    delete o.autoOpen;
                    debug.info('serial port ' + this._config.device + ' opened (' + JSON.stringify(o) + ')');
                    this._devices = devices || [];
                    this.resetTargets(true).then( () => {
                        this._openPromise.resolve();
                        this._openPromise = null;
                    }).catch ( (err2) => {
                        this._openPromise.reject(err2);
                        this._openPromise = null;
                    });
                }
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

    public async send (request: ModbusRequestFactory, timeoutMillis: number): Promise<ModbusRequest> {
        debug.info('send request, timeoutMillis=%s', timeoutMillis);
        if (!this._serialPort || this._openPromise) { throw new Error('serialPort not open'); }
        if (timeoutMillis <= 0) { throw new Error('invalid value for timeoutMillis'); }
        return new Promise<ModbusRequest>( (res, rej) => {
            const x: IPendingRequest = {
                requ: request,
                timer: null,
                timerModbus: null,
                resolve: <any>res,
                reject: rej
            };
            const thiz = this;
            x.timer = setTimeout( () => {
                thiz.handleTimeout(x, false);
            }, timeoutMillis);
            this._pending.push(x);
            if (this._pending.length === 1) {
                this.execute(this._pending[0]);
            }
        });
    }

    private async resetTargets (isOnStart?: boolean) {
        if (this._devices.length === 0) {
            debug.info('no devices known -> skip resetTargets');
            return;
        }
        const proms: Promise<ModbusRequest | IResetRequest> [] = [];
        for (const d of this._devices) {
            if (!d.config.reset) {
                 debug.info('no reset defined for target %s -> skip reset', d.name);
            } else if (d.config.reset.disabled === true) {
                debug.info('reset disabled for target %s -> skip reset', d.name);
            } else {
                const r: IResetRequest = {
                    device: d,
                    isOnStart: isOnStart
                };
                const p = new Promise<ModbusRequest | IResetRequest>( (res, rej) => {
                    const x: IPendingRequest = {
                        requ: r,
                        timer: null,
                        timerModbus: null,
                        resolve: res,
                        reject: rej
                    };
                    const thiz = this;
                    this._pending.push(x);
                    if (this._pending.length === 1) {
                        this.execute(this._pending[0]);
                    }
                });
                proms.push(p);
            }
        }
        await Promise.all(proms);
    }

    private async resetTarget(req: IPendingRequest) {
        const d = req && req.requ && (<IResetRequest>req.requ).device;
        const isOnStart = req && req.requ && (<IResetRequest>req.requ).isOnStart;
        if (!d || !d.config || !d.config.reset || d.config.reset.disabled === true) {
            return;
        }
        const r = d.config.reset;
        if (r.typ === 'user') {
            debug.info('reset configured as "user" for target %s -> skip reset', d.name);
            return;
        }
        try {
            this._receive.chars = false;
            this._receive.frames = false;
            const pin = '' + r.pin;
            const resetLevel = r.level === 'high' ? true : false;
            debug.info('reset target %s', d.name);
            this._receivedChars = '';
            this._receive.chars = true;
            if (isOnStart) {
                await Gpio.setup(pin, 'OUT');
                await Gpio.setPin(pin, !resetLevel);
                await Gpio.delayMillis(10);
            }
            this._receivedChars = '';
            this._receive.chars = true;
            await Gpio.setPin(pin, !resetLevel);
            await Gpio.delayMillis(10);
            await Gpio.setPin(pin, resetLevel);
            await Gpio.delayMillis(10);
            await Gpio.setPin(pin, !resetLevel);
            await Gpio.delayMillis(10);
            await Gpio.delayMillis(5000);
            debug.info('reset done for target %s\n-->%s', d.name, this._receivedChars);
            this.handleSuccess(req);
        } catch (err) {
            debug.warn('reset fails for target %s\%e', d.name, err);
            this.handleError(req, err);
        } finally {
            this._receive.chars = false;
            this._receivedChars = '';
            this._frame = '';
            this._receive.frames = true;
        }
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

        if (r.requ instanceof ModbusRequest) {
            let err: ModbusRequestError;
            if (modbusTimeout) {
                err = new ModbusRequestError('Modbus Timeout', r.requ);
            } else {
                err = new ModbusRequestError('Timeout', r.requ);
            }
            this.handleError(r, err);
        } else {
            this.handleError(r, new Error('Timeout'));
        }

    }

    private handleSuccess (r: IPendingRequest, result?: ModbusRequest) {
        if (this._pending.length > 0) {
            if (this._pending[0] === r) {
                this._pending.splice(0, 1);
                debug.finer('handleSuccess(): removing pending request, length = %s', this._pending.length);
            } else {
                debug.warn('handleSuccess(): wrong pending request -> skip removement');
            }
        }
        if (r.timer) {
            clearTimeout(r.timer);
            r.timer = null;
        }
        if (r.timerModbus) {
            clearTimeout(r.timerModbus);
            r.timerModbus = null;
        }

        r.resolve(r.requ);
        if (this._pending.length > 0) {
            this.execute(this._pending[0]);
        }

    }


    private handleError (r: IPendingRequest, err: ModbusRequestError | Error) {
        if (this._pending.length > 0) {
            this._pending.splice(0, 1);
            debug.finer('handleError(): removing pending request, length = %s', this._pending.length);
        }
        this._errCnt++;
        if (this._errCnt > 10) {
            debug.warn('modbus serial seems to be down, reset target?');
        } else if (this._errCnt > 5) {
            debug.warn('modbus serial not working');
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


    private execute (r: IPendingRequest) {
        if (r.requ instanceof ModbusRequest) {
            this.write(r);
        } else if (r.requ && (<IResetRequest>r.requ).device instanceof ModbusSerialDevice) {
            this.resetTarget(r);
        } else {
            this.handleError(r, new ModbusRequestError('invalid request', null));
        }
    }

    private write (r: IPendingRequest) {
        const thiz = this;
        process.nextTick( () => {
            if (!(r.requ instanceof ModbusRequest)) {
                this.handleError(r, new Error('invalid request in write()'));
                return;
            }
            const requ = <ModbusRequest>r.requ;
            this._serialPort.write(r.requ.request.frame, (err) => {
                if (err) {
                    this.handleError(r, new ModbusRequestError('serial interface error', err));
                } else {
                    if (debug.finest.enabled) {
                        debug.finest('pending length = %s', this._pending.length);
                        debug.finest('request written on serial interface (%o)', requ.request.buffer);
                    }
                    requ.sentAt = new Date();
                    r.timerModbus = setTimeout( () => {
                        debug.warn('Timeout %sms', Date.now() - requ.sentAt.getTime()) ;
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
        if (this._receive.chars) {
            this._frame = null;
            for (const b of data) {
                const c = String.fromCharCode(b);
                this._receivedChars += c;
            }
            return;
        }
        if (!this._receive.frames) {
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
                    if (!(r.requ instanceof ModbusRequest)) {
                        this.handleError(r, new Error('receive Modbus frame, but no modbus request pending'));
                        return;
                    }
                    const requ = <ModbusRequest>r.requ;
                    if (this._errCnt > 5) {
                        debug.info('modbus serial seems to work now');
                    }
                    this._errCnt = 0;
                    if (f) {
                        if (!requ.requestReceivedAt) {
                            try {
                                requ.requestReceived = f;
                                debug.finer('receive request (LRC %s) %o', f.lrcOk ? 'OK' : 'ERROR', f);
                            } catch (e) {
                                if (err) {
                                    debug.warn(err);
                                }
                                debug.warn('waiting for request, but receiving invalid frame\n%o\n%e', f, e);
                            }
                        } else {
                            requ.response = f;
                            debug.finer('receive response (LRC %s) %o', f.lrcOk ? 'OK' : 'ERROR', f);
                        }
                    }

                    if (err || requ.response) {
                        debug.finer('handleOnSerialData(): removing pending request -> length =%s', this._pending.length);
                        if (err) {
                            const message = err && err.message ? ' (' + err.message + ')' : '';
                            r.requ.error = new ModbusRequestError('Modbus request fails' + message, requ, err);
                            this.handleError(r, err);
                        } else  {
                            this.handleSuccess(r, requ);
                        }
                    }
                }
            }
        }
    }

}

interface IResetRequest {
    device: ModbusSerialDevice;
    isOnStart: boolean;
    error?: any;
}

interface IPendingRequest {
    requ?: ModbusRequestFactory | IResetRequest;
    timer: NodeJS.Timer;
    timerModbus: NodeJS.Timer;
    resolve: (requ: IResetRequest | ModbusRequest) => void;
    reject: (error: any) => void;
}
