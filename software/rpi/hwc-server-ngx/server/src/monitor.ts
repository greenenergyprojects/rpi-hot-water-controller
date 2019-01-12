
import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('monitor');

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

import { sprintf } from 'sprintf-js';
import * as nconf from 'nconf';
import { MonitorRecord, IMonitorRecord } from './data/common/hwc/monitor-record';
import { ModbusDevice } from './modbus/modbus-device';
import { HotWaterController } from './modbus/hot-water-controller';
import { runInThisContext } from 'vm';
import { Statistics } from './statistics';
import { Controller } from './controller';

export interface IMonitorConfig {
    disabled?: boolean;
    pollingPeriodMillis: number;
    tempFile?: { path: string; backups?: number };
}

interface ITempFileRecord {
    createdAt: Date;
    energyDaily: number;
    monitorRecord: IMonitorRecord;
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

    private static powerTable: { [ current: number ]: number } = {
        6: 2.8, 7: 5.7, 8: 26, 9: 48, 10: 122, 11: 257, 12: 460, 13: 716, 14: 1045, 15: 1292, 16: 1553, 17: 1730, 18: 1870, 19: 1935, 20: 1950
    };


    // ***************************************************************

    private _config: IMonitorConfig;
    private _eventEmitter: EventEmitter;
    private _timer: NodeJS.Timer;
    private _lastTempCnt = 0;
    private _lastRecord: MonitorRecord;
    private _energyDaily = 0;

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

    public async refresh (): Promise<MonitorRecord> {
        const hwc = HotWaterController.getInstance();
        // await hwc.refresh();
        debug.finer('current read done -> %s', sprintf('%.1f%s', hwc.current4To20mA.value, hwc.current4To20mA.unit));
        const ctrl = Controller.getInstance();
        const rData: IMonitorRecord = {
            createdAt: Date.now(),
            mode: ctrl.mode,
            powerSetting: ctrl.powerSetting.toObject(),
            activePower: Controller.getInstance().activePower.toObject(),
            setpointPower: ctrl.setpointPower.toObject(),
            maxPower: ctrl.setpointPower.toObject(),
            energy: [],
            current4to20mA: {
                setpoint: hwc.setpoint4To20mA.toObject(),
                current: hwc.current4To20mA.toObject()
            }
        };
        debug.finer('%O', rData);

        if (this._lastRecord) {
            const dayHasChanged =  this._lastRecord.createdAt.getDay() !==  new Date().getDay();
            if (dayHasChanged) {
                debug.finer('day has changed -> reset energyDaily');
                this._energyDaily = 0;
            }
            const dt = +rData.createdAt - this._lastRecord.createdAt.getTime();
            if (dt > 10000) {
                debug.warn('dt>10s (dt=%d) -> skip energy accumulation', sprintf('%.02fs', dt / 1000));
            } else if (!(rData.activePower.value >= 0)) {
                debug.warn('activePower unkown -> skip energy accumulation');
            } else if (rData.activePower.unit !== 'W') {
                debug.warn('wrong unit (' + rData.activePower.unit + ') on activePower -> skip energy accumulation');
            } else {
                this._energyDaily += rData.activePower.value * dt / 3600000;
            }
        }
        rData.energyDaily = { createdAt: rData.createdAt, value: this._energyDaily, unit: 'Wh' };

        const r = new MonitorRecord(rData);
        debug.finer('monitor emits data: %o', r);
        this._lastRecord = r;
        Statistics.Instance.handleMonitorRecord(r);
        this._eventEmitter.emit('data', r);
        this.saveTemp(r);
        return r;
    }

    private async init () {
        if (this._config.disabled) { return; }
        if (this._config.tempFile && this._config.tempFile.path) {
            const backups = this._config.tempFile.backups > 0 ? this._config.tempFile.backups : 1;
            let found: ITempFileRecord;
            const now = new Date();
            let fn: string;
            for (let i = 0; i < backups; i++) {
                fn = this._config.tempFile.path + '.' + i;
                if (!fs.existsSync(fn)) { continue; }
                try {
                    const s = fs.readFileSync(fn).toString('utf-8');
                    const o: ITempFileRecord = <ITempFileRecord>JSON.parse(s);
                    if (o.energyDaily >= 0) {
                        o.createdAt = new Date(o.createdAt);
                        if (!found || found.createdAt < o.createdAt) {
                            if (now.toDateString() === o.createdAt.toDateString()) {
                                found = o;
                            }
                        }
                    }
                } catch (err) {
                    debug.warn('error on reading %s\n%e', fn, err);
                }
            }
            if (!found) {
                debug.warn('cannot find temporary file...');
            } else if (found.energyDaily >= 0) {
                debug.info('temporary file found, set energyDaily to ' + found.energyDaily);
                this._energyDaily = found.energyDaily;
            } else {
                debug.warn('missing energyDaily in file %s', fn);
            }
        }

        this._timer = setInterval( () => this.handleTimerEvent(), this._config.pollingPeriodMillis);
    }


    private saveTemp (r: MonitorRecord) {
        if (!this._config.tempFile || !this._config.tempFile.path) {
            return;
        }
        try {
            const t: ITempFileRecord = {
                createdAt: new Date(),
                energyDaily: Math.round(this._energyDaily * 100) / 100,
                monitorRecord: r.toObject()
            };
            const tOut = JSON.stringify(t, null, 2) + '\n';
            const backups = this._config.tempFile.backups > 0 ? this._config.tempFile.backups : 1;
            const index = (this._lastTempCnt + 1) % backups;
            this._lastTempCnt = index;
            const fn = this._config.tempFile.path + '.' + index;
            fs.writeFile(fn, tOut, { encoding: 'utf-8' }, (err) => {
                if (err) {
                    debug.warn('tempFile error\n%e', err);
                } else if (debug.fine.enabled) {
                    debug.finer('temp file ' + fn + ' written');
                }
            } );

        } catch (err) {
            debug.warn('tempFile error\n%e', err);
        }
    }


    private async handleTimerEvent () {
        try {
            debug.finer('handleTimerEvent');
            await this.refresh();
        } catch (err) {
            debug.warn('%e', err);
        }
    }


}
