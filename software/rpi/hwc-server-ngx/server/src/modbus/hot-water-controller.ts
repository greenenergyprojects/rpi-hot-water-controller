import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('modbus:HotWaterController');

import { EventEmitter } from 'events';

import { sprintf } from 'sprintf-js';

import { ModbusDevice } from './modbus-device';
import { ModbusSerial } from './modbus-serial';
import { ModbusFrame } from './modbus-frame';
import { ModbusRequest, ModbusRequestFactory } from './modbus-request';
import { ModbusSerialDevice } from './modbus-serial-device';


export interface IHotWaterControllerValues {
    lastUpdateAt: Date;      // time stamp of received value
    setpoint4To20mA: number; // setpoint, floating point value 0.0 ... 20.0 mA
    current4To20mA: number;  // measured, floating point value 0.0 ... 20.0 mA
}


export class HotWaterController extends ModbusSerialDevice implements IHotWaterControllerValues {

    public static getInstance (id: string | number): HotWaterController {
        id = id.toString();
        let rv = ModbusDevice.getInstance(id);
        if (!rv) {
            rv = ModbusDevice.instances.find( (d) => (d instanceof HotWaterController) && (d.address === +id) );
        }
        return rv instanceof HotWaterController ? rv : null;
    }

    // *******************************************************************

    private _lastUpdateAt: Date;
    private _lastDemandAt: Date;
    private _eventEmitter: EventEmitter;

    private _setpoint4To20mA: number;
    private _current4To20mA: number;

    public constructor (serial: ModbusSerial, address: number) {
        super(serial, address);
        this._eventEmitter = new EventEmitter();
    }

    public get id (): string {
        return 'hwc:' + this.address;
    }

    public on (event: 'update', listener: (values: IHotWaterControllerValues) => void) {
        this._eventEmitter.on(event, listener);
        return this;
    }

    public off (event: 'update', listener: (values: IHotWaterControllerValues) => void) {
        this._eventEmitter.removeListener(event, listener);
        return this;
    }


    // public handleResponse (requ: ModbusFrame, resp: ModbusFrame) {
    //     let err: Error;
    //     if (!requ || !requ.ok || !requ.checkSumOk || requ.address !== this.address) {
    //         err = new Error('invalid request, cannot handle response');
    //     } else if (!resp || !resp.ok || !resp.checkSumOk || resp.address !== this.address || (resp.byteAt(2) !== (requ.wordAt(4) * 2))) {
    //         err = new Error('invalid response');
    //     }
    //     switch (resp.funcCode) {
    //         case 0x03: {
    //                 const l = resp.buffer.length - 3;
    //                 if (l !== 4) {
    //                     err = new Error('invalid response, wrong number of registers');
    //                 } else {
    //                     this.setHoldRegisters(resp.buffer, 3, l);
    //                     debug.finer('%O', this.toValuesObject());
    //                 }
    //                 break;
    //         }
    //         default: {
    //             err = new Error('invalid function code, cannot handle response'); break;
    //         }
    //     }
    //     if (err) {
    //         debug.warn(err);
    //         throw err;
    //     }
    // }

    public async readCurrent4To20mA () {
        const id = 1;
        const quantity = 1;
        const requ =  ModbusRequestFactory.createReadHoldRegister(1, id + 1, quantity);
        const mr = await this.serial.send(requ);
        this._current4To20mA = mr.response.wordAt(3) / 2048;
        debug.info('current = %smA', sprintf('%.2f', this. _current4To20mA));
    }

    public async writeCurrent4To20mA (value: number) {
        const id = 0;
        const quantity = 1;
        if (!(value >= 0 && (value * 2048) <= 0xffff)) {
            throw new Error('illegal value ' + value);
        }
        value = value * 2048;
        const requ =  ModbusRequestFactory.createWriteHoldRegister(1, id + 1, value);
        const mr = await this.serial.send(requ);
        debug.info('set current => %o', mr.response.frame);
    }

    public get lastUpdateAt (): Date {
        return this._lastUpdateAt;
    }

    public get setpoint4To20mA (): number {
        return this._setpoint4To20mA;
    }

    public get current4To20mA (): number {
        return this._current4To20mA;
    }


    public toValuesObject (): IHotWaterControllerValues {
        const rv = {
            lastUpdateAt:    this._lastUpdateAt,
            setpoint4To20mA: this._setpoint4To20mA,
            current4To20mA:  this._current4To20mA
        };
        return rv;
    }

}
