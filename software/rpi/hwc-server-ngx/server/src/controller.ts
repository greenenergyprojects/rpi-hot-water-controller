
import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('controller');

import * as nconf from 'nconf';

import * as hwc from './data/common/hwc/monitor-record';
import { DataRecord } from './data/common/data-record';
// import { Value, IValue } from './data/common/hwc/value';
import { HotWaterController } from './modbus/hot-water-controller';
import { sprintf } from 'sprintf-js';
import { ControllerParameter, IControllerParameter } from './data/common/hwc/controller-parameter';
import { IControllerStatus, ControllerStatus } from './data/common/hwc/controller-status';

import { ControllerMode } from './data/common/hwc/controller-mode';
import { IValue } from './data/common/hwc/value';

interface IControllerConfig {
    startMode: 'off' | 'power' | 'test';
    powerSetting: {
        minWatts: number;
        maxWatts: number;
        desiredWatts: number;
    };
}

export class Controller {
    public static async createInstance (config?: IControllerConfig): Promise<Controller> {
        this._instance = new Controller(config);
        return this._instance;
    }

    public static getInstance (): Controller {
        if (Controller._instance === undefined) {
            Controller._instance = new Controller();
        }
        return Controller._instance;
    }

    private static _instance: Controller;

    // ************************************************

    private _config:        IControllerConfig;
    private _parameter:     ControllerParameter;
    private _mode:          ControllerMode;
    private _setpointPower: number;
    private _activePower:   number;
    private _energyDaily:   number;
    private _energyTotal:   number;

    private _lastRefresh: { at: Date, activePower: number };
    private _timer: NodeJS.Timer;

    private constructor (config?: IControllerConfig) {
        config = config || nconf.get('controller');
        if (!config) { throw new Error('missing config'); }
        if (DataRecord.enumToStringValues(ControllerMode).indexOf(config.startMode) < 0) {
            throw new Error('illegal value ("' + config.startMode + '") for startMode');
        }
        this._mode = <ControllerMode>config.startMode;
        if (config.powerSetting) {
            let startMode: ControllerMode;
            switch (config.startMode) {
                case 'off':   startMode = ControllerMode.off; break;
                case 'power': startMode = ControllerMode.power; break;
                case 'test':  startMode = ControllerMode.test; break;
                default: throw new Error('invalid mode ' + config.startMode);
            }
            this._parameter = new ControllerParameter({
                createdAt:    new Date(),
                from:        'config',
                mode:         startMode,
                desiredWatts: config.powerSetting.desiredWatts,
                minWatts:     config.powerSetting.minWatts,
                maxWatts:     config.powerSetting.maxWatts
            });
        }

        this._activePower = 0;
        this._energyDaily = 0;
        this._energyTotal = 0;

        this._config = config;
    }

    public async start () {
        if (this._timer) { throw new Error('controller already running'); }
        this._timer = setInterval( () => this.handleTimer(), 1000);
        // await this.refresh();
    }

    public async shutdown () {
        if (!this._timer) { throw new Error('controller not running'); }
        clearInterval(this._timer);
        this._timer = null;
        this._mode = ControllerMode.shutdown;
    }

    public toObject (convertDate = false): IControllerStatus {
        return this.getStatus().toObject(convertDate);
    }

    public getStatus (): ControllerStatus {
        return new ControllerStatus({
            createdAt:   Date.now(),
            parameter:   this._parameter.toObject(),
            mode:        this._mode,
            activePower: this._activePower,
            energyDaily: this._energyDaily,
            energyTotal: this._energyTotal
        });
    }


    public get mode (): ControllerMode {
        return this._mode;
    }

    public get activePower (): IValue {
        return { createdAt: Date.now(), createdFrom: 'controller', value: this._activePower, unit: 'W' };
    }

    public get energyDaily (): IValue {
        return { createdAt: Date.now(), createdFrom: 'controller', value: this._energyDaily, unit: 'Wh' };
    }

    public get energyTotal (): IValue {
        return { createdAt: Date.now(), createdFrom: 'controller', value: this._energyTotal, unit: 'Wh' };
    }

    public async setParameter (p: IControllerParameter): Promise<ControllerStatus> {
        this._parameter = new ControllerParameter(p);
        await this.refresh();
        return this.getStatus();
    }

    public setEnergyTotal (value: number) {
        if (this._lastRefresh) { throw new Error('energyTotal cannot be set if energy accumulation is in progress'); }
        this._energyTotal = value;
    }

    public setEnergyDaily (at: Date, value: number) {
        if (this._lastRefresh) { throw new Error('energyTotal cannot be set if energy accumulation is in progress'); }
        this._lastRefresh = { at: at, activePower: null };
        this._energyDaily = value;
    }

    public async refresh () {
        debug.finer('refresh');

        switch (this._parameter.mode) {
            case 'off': {
                this._mode = ControllerMode.off;
                this._setpointPower = 0;
                break;
            }

            case 'power': {
                this._mode = ControllerMode.power;
                this._setpointPower = this._parameter.desiredWatts;
                break;
            }

            case 'test': {
                this._mode = ControllerMode.test;
                this._setpointPower = 0;
                break;
            }
        }

        if (this._setpointPower < this._parameter.minWatts) {
            this._setpointPower = this._parameter.minWatts;
        }
        if (this._setpointPower > this._parameter.maxWatts) {
            this._setpointPower = this._parameter.maxWatts;
        }

        const hwctrl = HotWaterController.getInstance();
        await hwctrl.writeActivePower(this._setpointPower);
        await hwctrl.refresh();

        if (hwctrl.activePower.unit === 'W') {
            this._activePower = hwctrl.activePower.value;
        } else {
            debug.warn('invalid activePower from HotWaterController (%o), using 0W instead', hwctrl.activePower);
            this._activePower = 0;
        }

        if (!(this._activePower >= 0 && this._activePower <= 2500)) {
            debug.warn('invalid value for activPower (%o), using 0 instead', this._activePower);
            this._activePower = 0;
        }
        if (!(this._energyDaily >= 0)) {
            debug.warn('invalid value for energyDaily (%o) -> reset to 0', this._energyDaily);
            this._energyDaily = 0;
        }
        if (!(this._energyTotal >= 0)) {
            debug.warn('invalid value for energyTotal (%o) -> reset to 0', this._energyTotal);
            this._energyTotal = 0;
        }

        const now = new Date();
        if (this._lastRefresh) {
            if (this._lastRefresh.at.getDate() !== now.getDate()) {
                debug.info('change of day, setting energyDaily from %fWh -> 0Wh', this._energyDaily);
                this._energyDaily = 0;
            }
            const dt = now.getTime() - this._lastRefresh.at.getTime();
            if (dt > 10000) {
                debug.warn('dt>10s (dt=%d) -> skip energy accumulation', sprintf('%.02fs', dt / 1000));
            } else if (!(this._activePower >= 0)) {
                debug.warn('activePower unkown -> skip energy accumulation');
            } else if (this._lastRefresh.activePower >= 0) {
                this._energyDaily += (this._activePower + this._lastRefresh.activePower) / 2 * dt / 3600000;
                this._energyTotal += (this._activePower + this._lastRefresh.activePower) / 2 * dt / 3600000;
            }
        }
        this._lastRefresh = { at: now, activePower: this._activePower };
    }


    private async handleTimer () {
        try {
            await this.refresh();
        } catch (err) {
            debug.warn('%e', err);
        }
    }

}
