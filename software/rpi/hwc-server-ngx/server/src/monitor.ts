
import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('monitor');

import { sprintf } from 'sprintf-js';
import { EventEmitter } from 'events';
import * as nconf from 'nconf';
import { MonitorRecord, IMonitorRecord } from './data/common/monitor-record';
import { ModbusDevice } from './modbus/modbus-device';
import { HotWaterController } from './modbus/hot-water-controller';
import { runInThisContext } from 'vm';

export interface IMonitorConfig {
    disabled?: boolean;
    pollingPeriodMillis: number;
}

export class Monitor {

    public static async createInstance (config?: IMonitorConfig): Promise<Monitor> {
        this._instance = new Monitor(config);
        await this._instance.init();
        return this._instance;
    }

    public static getInstance (): Monitor {
        if (!this._instance) {
            throw new Error('Monitor instance not created yet');
        }
        return this._instance;
    }

    private static _instance: Monitor;

    // ***************************************************************

    private _config: IMonitorConfig;
    private _eventEmitter: EventEmitter;
    private _timer: NodeJS.Timer;
    private _lastRecord: MonitorRecord;

    private constructor (config?: IMonitorConfig) {
        config = config || nconf.get('monitor');
        if (!config) {
            this._config = { disabled: true, pollingPeriodMillis: undefined };
        } else if (config.disabled === true) {
            this._config = Object.assign({}, config);
        } else if (!(config.pollingPeriodMillis > 0)) {
            throw new Error('invalid monitor configuration (pollingPeriodMillis)');
        } else {
            this._config = Object.assign({}, config);
        }
        this._eventEmitter = new EventEmitter();
    }

    public async shutdown () {
        if (this._config.disabled || !this._timer) { return; }
        clearInterval(this._timer);
        this._timer = null;
        Monitor._instance = null;
    }

    public on (event: 'data', listener: (values: MonitorRecord) => void) {
        this._eventEmitter.on(event, listener);
        return this;
    }

    public off (event: 'data', listener: (values: MonitorRecord) => void) {
        this._eventEmitter.removeListener(event, listener);
        return this;
    }

    public get lastRecord (): MonitorRecord {
        return this._lastRecord;
    }

    private async init () {
        if (this._config.disabled) { return; }
        this._timer = setInterval( () => this.handleTimerEvent(), this._config.pollingPeriodMillis);
    }

    private async handleTimerEvent () {
        try {
            debug.fine('handleTimerEvent');
            const d = ModbusDevice.getInstance('hwc:1');
            if (d instanceof HotWaterController) {
                const hwc = <HotWaterController>d;
                await hwc.readHoldRegister(1, 2);
                debug.fine('current read done -> %s', sprintf('%.1f%s', hwc.current4To20mA.value, hwc.current4To20mA.unit));
                const rData: IMonitorRecord = {
                    createdAt: Date.now(),
                    powerWatts: 0,
                    energy: [],
                    current4to20mA: {
                        setpoint: hwc.setpoint4To20mA.toObject(),
                        current: hwc.current4To20mA.toObject()
                    }
                };
                const r = new MonitorRecord(rData);
                debug.finer('monitor emits data: %o', r);
                this._lastRecord = r;
                this._eventEmitter.emit('data', r);

            }
        } catch (err) {
            debug.warn('%e', err);
        }
    }


}
