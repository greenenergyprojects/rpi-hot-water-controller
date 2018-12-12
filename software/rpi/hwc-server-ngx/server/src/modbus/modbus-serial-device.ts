
import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('modbus:ModbusSerialDevice');


import { ModbusDevice, IModbusDeviceConfig } from './modbus-device';
import { ModbusSerial } from './modbus-serial';

export interface IModbusSerialDeviceResetConfig {
    disabled?: boolean;
    onstart: boolean;
    typ: 'rpi-gpio' | 'user';
    pin: number;
    level: 'low' | 'high';
    timeMillis: number;
}

export interface IModbusSerialDeviceConfig extends IModbusDeviceConfig {
    serialDevice: string;
    slaveAddress: number;
    reset?: IModbusSerialDeviceResetConfig;
}

export abstract class ModbusSerialDevice extends ModbusDevice {

    private _serial: ModbusSerial;

    constructor (serial: ModbusSerial, config: IModbusSerialDeviceConfig) {
        super(config);
        this._serial = serial;
    }

    public get config (): IModbusSerialDeviceConfig {
        return <IModbusSerialDeviceConfig>super.config;
    }

    public get serial (): ModbusSerial {
        return this._serial;
    }

}
