
import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('modbus:ModbusDevice');

// import { sprintf } from 'sprintf-js';
// import { EventEmitter } from 'events';
import { ModbusFrame } from './modbus-frame';
import { IModbusSerialDeviceConfig } from './modbus-serial-device';

export abstract class ModbusDevice  {

    public static getInstance (name: string): ModbusDevice {
        const rv = this._instances[name];
        if (rv instanceof ModbusDevice) {
            return rv;
        }
        return null;
    }

    public static addInstance (device: ModbusDevice) {
        for (const n of Object.getOwnPropertyNames(this._instances)) {
            const d = this._instances[n];
            if (d.name === device.name) { throw new Error('name ' + device.name + ' already used'); }
            if (!d.isModbusTcpDevice && !device.isModbusTcpDevice && d.slaveAddress === device.slaveAddress) {
                throw new Error('mdobus device with slaveAddress ' + device.slaveAddress + ' already used');
            }
            if (d.isModbusTcpDevice && device.isModbusTcpDevice) {
                if (d.serverHost === device.serverHost && d.serverPort === device.serverPort && d.unitId === device.unitId) {
                    throw new Error('mdobus tcp device with ' + d.serverHost + ':' + d.serverPort + '/' + d.unitId + ' already used');
                }
            }
        }
        this._instances[device.name] = device;
    }


    public static get instances (): ModbusDevice [] {
        const rv: ModbusDevice [] = [];
        for (const i in this._instances) {
            if (!this._instances.hasOwnProperty(i)) { continue; }
            rv.push(this._instances[i]);
        }
        return rv;
    }

    private static _instances: { [ addr: string ]: ModbusDevice } = {};

    // *****************************************************************************

    private _config: IModbusSerialDeviceConfig | IModbusTcpDeviceConfig;

    public constructor (config: IModbusSerialDeviceConfig | IModbusTcpDeviceConfig) {
        if (!config || !config.name || !(config.timeoutMillis > 0)) {
            throw new Error('invalid modbus device configuration (missing config/name)');
        }
        if (!(config.timeoutMillis > 0)) {
            throw new Error('invalid modbus device configuration (missing timeoutMillis)');
        }
        this._config = config;
        if (config.type === 'modbus-tcp') {
            const cfg = <IModbusTcpDeviceConfig>this._config;
            if (!cfg.serverHost || cfg.port < 0 || cfg.port > 0xffff) {
                throw new Error('invalid modbus device configuration');
            }
            if (cfg.unitId === undefined) {
                cfg.unitId = 0; // device is no bridge
            } else if (!(cfg.unitId > 0 && cfg.unitId < 255)) {
                throw new Error('invalid unitId in modbus device configuration');
            }
        } else if (config.type === 'modbus-rtu' || config.type === 'modbus-ascii') {
            const cfg = <IModbusSerialDeviceConfig>this._config;
            if (!(cfg.slaveAddress >= 1 && cfg.slaveAddress <= 254)) {
                throw new Error('invalid modbus device configuration');
            }
            if (!cfg.serialDevice) {
                throw new Error('missing serialDevice in modbus device configuration');
            }
        } else {
            throw new Error('invalid modbus device configuration');
        }
    }

    public get config (): IModbusSerialDeviceConfig | IModbusTcpDeviceConfig {
        return this._config;
    }

    public get isModbusTcpDevice (): boolean {
        return this._config.type === 'modbus-tcp';
    }

    public get isModbusAsciiDevice (): boolean {
        return this._config.type === 'modbus-ascii';
    }

    public get isModbusRtuDevice (): boolean {
        return this._config.type === 'modbus-rtu';
    }

    public get name (): string {
        return this._config.name;
    }

    public get timeoutMillis (): number {
        return this._config.timeoutMillis;
    }

    public get slaveAddress (): number {
        if (!this.isModbusAsciiDevice && ! this.isModbusRtuDevice) {
            throw new Error('modbus device is no serial modbus device');
        }
        const cfg = <IModbusSerialDeviceConfig>this._config;
        return cfg.slaveAddress;
    }

    public get serialDevice (): string {
        if (!this.isModbusAsciiDevice && ! this.isModbusRtuDevice) {
            throw new Error('modbus device is no serial modbus device');
        }
        const cfg = <IModbusSerialDeviceConfig>this._config;
        return cfg.serialDevice;
    }

    public get serverHost (): string {
        if (!this.isModbusTcpDevice) {
            throw new Error('modbus device is no modbus-tcp device');
        }
        const cfg = <IModbusTcpDeviceConfig>this._config;
        if (!cfg.serverHost) {
            throw new Error('modbus device has no serverHost');
        }
        return cfg.serverHost;
    }

    public get serverPort (): number {
        if (!this.isModbusTcpDevice) {
            throw new Error('modbus device is no modbus-tcp device');
        }
        const cfg = <IModbusTcpDeviceConfig>this._config;
        return cfg.port >= 0 && cfg.port <= 0xffff ? cfg.port : 502;
    }

    public get unitId (): number {
        if (!this.isModbusTcpDevice) {
            throw new Error('modbus device is no modbus-tcp device');
        }
        const cfg = <IModbusTcpDeviceConfig>this._config;
        return cfg.unitId;
    }


    public handleResponse (requ: ModbusFrame, resp: ModbusFrame) {
        debug.warn('handleResponse() not implemented');
    }
}


export interface IModbusDeviceConfig {
    disabled?: boolean;
    name: string;
    type: 'modbus-ascii' | 'modbus-rtu' | 'modbus-tcp';
    class: string;
    timeoutMillis: number;
}

export interface IModbusTcpDeviceConfig extends IModbusDeviceConfig {
    serverHost: string;
    port?: number;
    unitId?: number;
}
