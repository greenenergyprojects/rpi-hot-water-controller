
import * as debugsx from 'debug-sx';
const debug: debugsx.IDefaultLogger = debugsx.createDefaultLogger('controller');

import * as nconf from 'nconf';

import * as hwc from './data/common/hwc/monitor-record';
import { IPowerSetting, PowerSetting } from './data/common/hwc/power-setting';
import { DataRecord } from './data/common/data-record';
import { Value } from './data/common/hwc/value';
import { HotWaterController } from './modbus/hot-water-controller';

interface IController {
    startMode: 'off' | 'power';
    powerSetting: {
        minWatts: number;
        maxWatts: number;
        desiredWatts: number;
    };
}

export class Controller {

    public static async createInstance (config?: IController): Promise<Controller> {
        this._instance = new Controller(config);
        await this._instance.init();
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

    private _config: IController;
    private _mode: hwc.ControllerMode;
    private _powerSetting: PowerSetting;
    private _setpointPower: Value;
    private _maxPower: Value;
    private _activePower: Value;
    private _timer: NodeJS.Timer;

    private constructor (config?: IController) {
        config = config || nconf.get('controller');
        if (!config) { throw new Error('missing config'); }
        if (DataRecord.enumToStringValues(hwc.ControllerMode).indexOf(config.startMode) < 0) {
            throw new Error('illegal value ("' + config.startMode + '") for startMode');
        }
        this._mode = <hwc.ControllerMode>config.startMode;
        if (config.powerSetting) {
            const psCfg: IPowerSetting = {
                createdAt: Date.now(),
                createdFrom: 'config',
                minWatts: config.powerSetting.minWatts,
                maxWatts: config.powerSetting.maxWatts,
                desiredWatts: config.powerSetting.desiredWatts
            };
            this._powerSetting = new PowerSetting(psCfg);
        }
        let setpointWatts, maxWatts;
        if (this._mode === hwc.ControllerMode.off || this._mode === hwc.ControllerMode.test) {
            setpointWatts = 0;
            maxWatts = this._powerSetting.maxWatts;
        } else if (this._mode === hwc.ControllerMode.power) {
            setpointWatts = this._powerSetting.desiredWatts;
            maxWatts = this._powerSetting.maxWatts;
        } else {
            setpointWatts = 0;
            maxWatts = 0;
        }
        this._activePower = new Value({createdAt: Date.now(), createdFrom: 'controller:constructor', value: Number.NaN, unit: 'W'});
        this._setpointPower = new Value({createdAt: Date.now(), createdFrom: 'controller:constructor', value: setpointWatts, unit: 'W'});
        this._maxPower = new Value({createdAt: Date.now(), createdFrom: 'controller:constructor', value: maxWatts, unit: 'W'});

        this._config = config;
    }


    public async shutdown () {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
            this._mode = hwc.ControllerMode.shutdown;
        }
    }

    public get mode (): hwc.ControllerMode {
        return this._mode;
    }

    public setMode (value: string) {
        if (this._mode === hwc.ControllerMode.shutdown)  {
            throw new Error('controller in mode shutdown');
        }
        if (DataRecord.enumToStringValues(hwc.ControllerMode).indexOf(value) < 0) {
            throw new Error('illegal value ("' + value + '")');
        }
        if (value === hwc.ControllerMode.shutdown) {
            throw new Error('shutdown mode cannot be set');
        }
        const oldMode = this._mode;
        this._mode = <hwc.ControllerMode>value;
        if (oldMode !== this._mode) {
            debug.fine('set new mode %s', this._mode);
        }
    }

    public get powerSetting (): PowerSetting {
        return this._powerSetting;
    }

    public get setpointPower (): Value {
        return this._setpointPower;
    }

    public get maxPower (): Value {
        return this._maxPower;
    }

    public get activePower (): Value {
        return this._activePower;
    }


    public setPowerSetting (value: IPowerSetting) {
        if (this._mode === hwc.ControllerMode.shutdown)  {
            throw new Error('controller in mode shutdown');
        }
        const ps = new PowerSetting(value);
        if (!this.powerSetting.equals(ps, false)) {
            this._powerSetting = ps;
            debug.fine('set new power settings (%o)', this._powerSetting);
        }
    }

    public set setpointPower (value: Value) {
        this._setpointPower = value;
        debug.fine('set new setpointPower (%o)', this._setpointPower.toObject());
    }

    public set maxPower (value: Value) {
        this._maxPower = value;
        debug.fine('set new maxPower (%o)', this._maxPower.toObject());
    }

    public async refresh () {
        debug.info('refresh');
        const hwctrl = HotWaterController.getInstance();
        if (this._mode === hwc.ControllerMode.off) {
            await hwctrl.writeActivePower(0);
            await hwctrl.refresh();
            this._activePower = hwctrl.activePower;
        } else if (this._mode === hwc.ControllerMode.test) {
            const p = this._setpointPower.value;
            if (!(p >= 0) && (p <= 2000)) {
                throw new Error('setpointPower out of range, skip setting power');
            }
            debug.info('refresh mode test -> writeActivePower(%s)', p);
            await hwctrl.writeActivePower(p);
            debug.info('refresh mode test -> refresh');
            await hwctrl.refresh();
            this._activePower = hwctrl.activePower;
            debug.info('refresh mode test -> activePower = %s', this._activePower.value);
        }  else if (this._mode === hwc.ControllerMode.power) {
            const p = this._setpointPower.value;
            const max = this._maxPower.value;
            if (max >= 0 && p >= 0 && p <= 2000) {
                await hwctrl.writeActivePower(Math.min(p, max));
                await hwctrl.refresh();
                this._activePower = hwctrl.activePower;
            }
        } else {
            await hwctrl.refresh();
            this._activePower = hwctrl.activePower;
            throw new Error('unsupported mode');
        }

    }

    private async init () {
        this._timer = setInterval( () => this.handleTimer(), 1000);
    }

    private async handleTimer () {
        try {
            await this.refresh();
        } catch (err) {
            debug.warn('%e', err);
        }
    }





}