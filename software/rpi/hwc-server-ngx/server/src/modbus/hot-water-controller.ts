import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('modbus:HotWaterController');

import { EventEmitter } from 'events';

import { sprintf } from 'sprintf-js';

import { ModbusDevice } from './modbus-device';
import { ModbusSerial } from './modbus-serial';
import { ModbusFrame } from './modbus-frame';
import { ModbusRequest, ModbusRequestFactory } from './modbus-request';
import { ModbusSerialDevice, IModbusSerialDeviceConfig } from './modbus-serial-device';
import { Value, IValue } from '../data/common/hwc/value';


export interface IHotWaterControllerValues {
    lastUpdateAt: Date;      // time stamp of received value
    setpoint4To20mA: IValue; // setpoint, floating point value 0.0 ... 20.0 mA
    current4To20mA: IValue;  // measured, floating point value 0.0 ... 20.0 mA
}


export class HotWaterController extends ModbusSerialDevice implements IHotWaterControllerValues {

    public static getInstance (): HotWaterController {
        if (!this._instance) { throw new Error('instance not created yet'); }
        return this._instance;
    }

    public static async createInstance (serial: ModbusSerial, config: IModbusSerialDeviceConfig) {
        if (this._instance) { throw new Error('instance already created'); }
        this._instance = new HotWaterController(serial, config);
        return this._instance;
    }

    private static _instance: HotWaterController;
    private static powerTable: { [ current: number ]: number } = {
        6: 2.8, 7: 5.7, 8: 26, 9: 48, 10: 122, 11: 257, 12: 460, 13: 716, 14: 1045, 15: 1292, 16: 1553, 17: 1730, 18: 1870, 19: 1935, 20: 1950
    };


    // *****************************************************************

    private _lastUpdateAt: Date;
    private _lastDemandAt: Date;
    private _eventEmitter: EventEmitter;

    private _setpoint4To20mA: Value;
    private _current4To20mA: Value;
    private _activePower: Value;

    private constructor (serial: ModbusSerial, config: IModbusSerialDeviceConfig) {
        super(serial, config);
        this._eventEmitter = new EventEmitter();
        this._setpoint4To20mA = this.createValue(Number.NaN, 'mA');
        this._current4To20mA = this.createValue(Number.NaN, 'mA');
        this._activePower = this.createValue(Number.NaN, 'W');
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

    public async refresh () {
        await this.readHoldRegister(1, 2);
    }

    public async readHoldRegister(startAddress: number, quantity: number) {
        const requ =  ModbusRequestFactory.createReadHoldRegister(this.config.slaveAddress, startAddress, quantity);
        const mr = await this.serial.send(requ, this.config.timeoutMillis);
        for (let i = 0; i < quantity; i++) {
            const v = Math.round(mr.response.wordAt(3 + i * 2) / 2048 * 100) / 100;
            switch ( startAddress + i) {
                case 1: this._setpoint4To20mA = this.createValue(v, 'mA'); break;
                case 2: {
                    this._current4To20mA = this.createValue(v, 'mA' );
                    this._activePower = this.createValue(this.currentMilliAmpsToPowerWatts(v), 'W' );
                    break;
                }
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
        debug.finer('current4To20mA: write setpoint %d', value);
        const mr = await this.serial.send(requ, this.config.timeoutMillis);
    }

    public async writeActivePower (powerWatts: number) {
        await this.writeCurrent4To20mA(this.powerWattsToCurrentMilliAmps(powerWatts));
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

    public get activePower (): Value {
        return this._activePower;
    }


    public toValuesObject (): IHotWaterControllerValues {
        const rv = {
            lastUpdateAt:    this._lastUpdateAt,
            setpoint4To20mA: this._setpoint4To20mA.toObject(),
            current4To20mA:  this._current4To20mA.toObject()
        };
        return rv;
    }

    private createValue (value: number, unit: string): Value {
        return new Value({
            createdAt: Date.now(),
            createdFrom: 'HotWaterController',
            value: value,
            unit: unit
        });
    }

    private currentMilliAmpsToPowerWatts (currentMilliAmps: number): number {
        if (typeof (currentMilliAmps) !== 'number' || Number.isNaN(currentMilliAmps)) {
            debug.warn('invalid currentMilliAmps %s', currentMilliAmps);
            return 0;
        } else if (currentMilliAmps < 7) {
            return 0;
        } else if (currentMilliAmps > 20) {
            return HotWaterController.powerTable[20];
        } else {
            const p1 = HotWaterController.powerTable[Math.floor(currentMilliAmps)];
            const p2 = HotWaterController.powerTable[Math.floor(currentMilliAmps) + 1];
            const p = p1 + (p2 - p1) * (currentMilliAmps - Math.floor(currentMilliAmps));
            if (p < 0 || p > 2000) {
                debug.warn('invalid power value %f', p);
                return 0;
            } else {
                return p;
            }
        }
    }

    private powerWattsToCurrentMilliAmps (powerWatts: number): number {
        if (typeof (powerWatts) !== 'number' || Number.isNaN(powerWatts)) {
            debug.warn('invalid powerWatts %s', powerWatts);
            return 0;
        } else if (powerWatts <= HotWaterController.powerTable[6]) {
            return 0;
        } else if (powerWatts >= HotWaterController.powerTable[20]) {
            return 20;
        } else {
            for (let i = 6; i < 19; i++) {
                const p1 = HotWaterController.powerTable[i];
                const p2 = HotWaterController.powerTable[i + 1];
                if (powerWatts >= p1 && powerWatts <= p2) {
                    const k = p2 - p1;
                    const d = p1 - k * i;
                    const curr = Math.round((powerWatts - d) / k * 100) / 100;
                    if (curr < 0 || curr > 20) {
                        debug.warn('calculation error (current=%f) from power value %f', curr, powerWatts);
                        return 0;
                    }
                    return curr;
                }
            }
            debug.warn('cannot calculate current from power value %f', powerWatts);
            return 0;
        }
    }

}
