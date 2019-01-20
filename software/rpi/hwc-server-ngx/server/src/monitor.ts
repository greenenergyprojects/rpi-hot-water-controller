
import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('monitor');

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

import { sprintf } from 'sprintf-js';
import * as nconf from 'nconf';
import { MonitorRecord, IMonitorRecord } from './data/common/hwc/monitor-record';
import { HotWaterController } from './modbus/hot-water-controller';
import { Statistics } from './statistics';
import { Controller } from './controller';
import { IControllerStatus } from './data/common/hwc/controller-status';
import { SmartModeValues } from './data/common/hwc/smart-mode-values';

export interface IMonitorConfig {
    disabled?: boolean;
    pollingPeriodMillis: number;
    tempFile?: { path: string; backups?: number };
}

interface ITempFileRecord {
    createdAt: Date;
    energyDaily: number;
    energyTotal: number;
    controllerStatus: IControllerStatus;
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
        const now = new Date();
        const rData: IMonitorRecord = {
            createdAt: now,
            controller: Controller.getInstance().toObject(),
            current4to20mA: {
                setpoint: hwc.setpoint4To20mA.toObject(),
                current: hwc.current4To20mA.toObject()
            }
        };
        debug.finer('%O', rData);

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
            const found: ITempFileRecord [] = [];
            const now = new Date();
            let fn: string;
            for (let i = 0; i < backups; i++) {
                fn = this._config.tempFile.path + '.' + i;
                if (!fs.existsSync(fn)) { continue; }
                try {
                    const s = fs.readFileSync(fn).toString('utf-8');
                    const o: ITempFileRecord = <ITempFileRecord>JSON.parse(s);
                    o.createdAt = new Date(o.createdAt);
                    if (o.createdAt instanceof Date && o.energyDaily >= 0 && o.energyTotal >= 0) {
                        found.push(o);
                    }
                } catch (err) {
                    debug.warn('error on reading %s\n%e', fn, err);
                }
            }
            if (found.length === 0) {
                debug.warn('cannot find temporary file...');
            } else {
                let newest: ITempFileRecord;
                for (const o of found) {
                    if (!newest || newest.createdAt < o.createdAt) {
                        newest = o;
                    }
                }
                if (debug.finer.enabled) {
                    debug.info('temporary file found\n%o', newest);
                } else {
                    debug.info('temporary file found');
                }
                const ctrl = Controller.getInstance();
                ctrl.setEnergyTotal(newest.energyTotal);
                try {
                    ctrl.setSmartModeValues(new SmartModeValues(newest.controllerStatus.smartModeValues));
                    ctrl.setSetpointPower(newest.controllerStatus.setpointPower);
                    ctrl.setParameter(newest.controllerStatus.parameter);
                } catch (err) {
                    debug.warn('cannot set controller parameter/values\n%e', err);
                }
                if (newest.createdAt.toDateString() === now.toDateString()) {
                    ctrl.setEnergyDaily(newest.createdAt, newest.energyDaily);
                }
            }
        }

        this._timer = setInterval( () => this.handleTimerEvent(), this._config.pollingPeriodMillis);
    }


    private saveTemp (r: MonitorRecord) {
        if (!this._config.tempFile || !this._config.tempFile.path) {
            return;
        }
        try {
            const ctrl = Controller.getInstance();
            const eDaily = ctrl.energyDaily;
            if (!eDaily || !(eDaily.value >= 0) || eDaily.unit !== 'Wh') { throw new Error('invalid eDaily'); }
            const eTotal = ctrl.energyTotal;
            if (!eTotal || !(eTotal.value >= 0) || eTotal.unit !== 'Wh') { throw new Error('invalid eTotal'); }
            const t: ITempFileRecord = {
                createdAt: new Date(),
                energyDaily: Math.round(eDaily.value * 100) / 100,
                energyTotal: Math.round(eTotal.value),
                controllerStatus: ctrl.toObject(),
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
