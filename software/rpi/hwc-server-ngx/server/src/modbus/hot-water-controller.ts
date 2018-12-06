import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('modbus:HotWaterController');

import { EventEmitter } from 'events';

import { sprintf } from 'sprintf-js';

import { ModbusDevice } from './modbus-device';
import { ModbusSerial } from './modbus-serial';
import { ModbusFrame } from './modbus-frame';
import { ModbusRequest, ModbusRequestFactory } from './modbus-request';
import { ModbusSerialDevice, IModbusSerialDeviceConfig } from './modbus-serial-device';
import { Value, IValue } from '../data/common/value';


export interface IHotWaterControllerValues {
    lastUpdateAt: Date;      // time stamp of received value
    setpoint4To20mA: IValue; // setpoint, floating point value 0.0 ... 20.0 mA
    current4To20mA: IValue;  // measured, floating point value 0.0 ... 20.0 mA
}


export class HotWaterController extends ModbusSerialDevice implements IHotWaterControllerValues {

    private _lastUpdateAt: Date;
    private _lastDemandAt: Date;
    private _eventEmitter: EventEmitter;

    private _setpoint4To20mA: Value;
    private _current4To20mA: Value;

    public constructor (serial: ModbusSerial, config: IModbusSerialDeviceConfig) {
        super(serial, config);
        this._eventEmitter = new EventEmitter();
    }

    public on (event: 'update', listener: (values: IHotWaterControllerValues) => void) {
        this._eventEmitter.on(event, listener);
        return this;
    }

    public off (event: 'update', listener: (values: IHotWaterControllerValues) => void) {
        this._eventEmitter.removeListener(event, listener);
        return this;
    }

    public get config (): IModbusSerialDeviceConfig {
        return <IModbusSerialDeviceConfig>super.config;
    }


    public async readHoldRegister(startAddress: number, quantity: number) {
        const requ =  ModbusRequestFactory.createReadHoldRegister(this.config.slaveAddress, startAddress, quantity);
        const mr = await this.serial.send(requ, this.config.timeoutMillis);
        for (let i = 0; i < quantity; i++) {
            const v = Math.round(mr.response.wordAt(3 + i * 2) / 2048 * 100) / 100;
            switch ( startAddress + i) {
                case 1: this._setpoint4To20mA = new Value({ createdAt: Date.now(), value: v, unit: 'mA' }); break;
                case 2: this._current4To20mA = new Value({ createdAt: Date.now(), value: v, unit: 'mA' }); break;
                default: debug.warn('hold register addr %d not handled', startAddress + i);
            }
        }
    }

    public async readCurrent4To20mA () {
        await this.readHoldRegister(2, 1);
        if (debug.finer.enabled) {
            debug.finer('current = %s', sprintf('%.2f%s', this. _current4To20mA.value, this. _current4To20mA.unit));
        }
    }

    public async writeCurrent4To20mA (value: number) {
        const id = 0;
        const quantity = 1;
        if (!(value >= 0 && (value * 2048) <= 0xffff)) {
            throw new Error('illegal value ' + value);
        }
        value = value * 2048;
        const requ =  ModbusRequestFactory.createWriteHoldRegister(this.config.slaveAddress, id + 1, value);
        debug.fine('current4To20mA: write setpoint %d', value);
        const mr = await this.serial.send(requ, this.config.timeoutMillis);
    }

    public get lastUpdateAt (): Date {
        return this._lastUpdateAt;
    }

    public get setpoint4To20mA (): Value {
        return this._setpoint4To20mA;
    }

    public get current4To20mA (): Value {
        return this._current4To20mA;
    }


    public toValuesObject (): IHotWaterControllerValues {
        const rv = {
            lastUpdateAt:    this._lastUpdateAt,
            setpoint4To20mA: this._setpoint4To20mA.toObject(),
            current4To20mA:  this._current4To20mA.toObject()
        };
        return rv;
    }

}
