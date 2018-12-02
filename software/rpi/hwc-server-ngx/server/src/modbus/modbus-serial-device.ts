
import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('modbus:ModbusSerialDevice');


import { ModbusDevice } from './modbus-device';
import { ModbusSerial } from './modbus-serial';


export abstract class ModbusSerialDevice extends ModbusDevice {

    private _serial: ModbusSerial;

    constructor (serial: ModbusSerial, address: number) {
        super(address);
        this._serial = serial;
    }

    public get serial (): ModbusSerial {
        return this._serial;
    }

}
