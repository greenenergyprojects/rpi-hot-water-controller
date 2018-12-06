
import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('modbus:ModbusSerialDevice');


import { ModbusDevice, IModbusDeviceConfig } from './modbus-device';
import { ModbusSerial } from './modbus-serial';

export interface IModbusSerialDeviceConfig extends IModbusDeviceConfig {
    serialDevice: string;
    slaveAddress: number;
}

export abstract class ModbusSerialDevice extends ModbusDevice {

    private _serial: ModbusSerial;

    constructor (serial: ModbusSerial, config: IModbusSerialDeviceConfig) {
        super(config);
        this._serial = serial;
    }

    public get serial (): ModbusSerial {
        return this._serial;
    }

}
