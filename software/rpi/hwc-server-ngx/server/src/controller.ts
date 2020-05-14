
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
import { SmartModeParameter } from './data/common/hwc/smart-mode-parameter';
import { SmartModeValues } from './data/common/hwc/smart-mode-values';
import { ControllerMode } from './data/common/hwc/controller-mode';
import { IValue } from './data/common/hwc/value';

interface IControllerConfig {
    startMode: 'off' | 'on' | 'power' | 'smart' | 'test';
    powerSetting: {
        minWatts: number;
        maxWatts: number;
        desiredWatts: number;
    };
    smartSetting: {
        minEBatPercent: number;
        minWatts: number;
        maxWatts: number;
    };
    froniusMeterDefect?: boolean;
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

    private _config:         IControllerConfig;
    private _parameter:      ControllerParameter;
    private _mode:           ControllerMode;
    private _smartModeValues:    SmartModeValues;
    private _setpointPower:  number;
    private _activePower:    number;
    private _energyDaily:    number;
    private _energyTotal:    number;

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
                case 'on':    startMode = ControllerMode.on; break;
                case 'power': startMode = ControllerMode.power; break;
                case 'smart': startMode = ControllerMode.smart; break;
                case 'test':  startMode = ControllerMode.test; break;
                default: throw new Error('invalid mode ' + config.startMode);
            }
            this._parameter = new ControllerParameter({
                createdAt:           new Date(),
                from:               'config',
                mode:                startMode,
                desiredWatts:        config.powerSetting.desiredWatts,
                minWatts:            config.powerSetting.minWatts,
                maxWatts:            config.powerSetting.maxWatts,
                smart: {
                    minEBatPercent: config.smartSetting.minEBatPercent,
                    minWatts:       config.smartSetting.minWatts,
                    maxWatts:       config.smartSetting.maxWatts
                }
            });
        }


        this._smartModeValues = null;
        this._setpointPower = 0;
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
            createdAt:       Date.now(),
            parameter:       this._parameter.toObject(),
            mode:            this._mode,
            smartModeValues: this._smartModeValues.toObject(),
            setpointPower:   this._setpointPower,
            activePower:     this._activePower,
            energyDaily:     this._energyDaily,
            energyTotal:     this._energyTotal
        });
    }


    public get parameter (): ControllerParameter {
        return this._parameter;
    }

    public get mode (): ControllerMode {
        return this._mode;
    }

    public get smartModeValues (): SmartModeValues {
        return this._smartModeValues;
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

    public setSetpointPower (value: number) {
        if (value >= 0 && value <= 2000) {
            this._setpointPower = value;
        }
    }

    public async setParameter (p: IControllerParameter): Promise<ControllerStatus> {
        this._parameter = new ControllerParameter(p);
        await this.refresh();
        return this.getStatus();
    }

    public setSmartModeValues (values: SmartModeValues) {
        this._smartModeValues = values;
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

        if (this._smartModeValues) {
            if (Date.now() - this._smartModeValues.createdAt.getTime() > 60000) {
                this._smartModeValues = null;
            }
        }

        debug.finest('refresh()): mode=%s', this._parameter.mode);
        switch (this._parameter.mode) {
            case 'off': {
                this._mode = ControllerMode.off;
                this._setpointPower = 0;
                break;
            }

            case 'on': {
                this._mode = ControllerMode.on;
                this._setpointPower = 2000;
                break;
            }

            case 'power': {
                this._mode = ControllerMode.power;
                this._setpointPower = this._parameter.desiredWatts;
                if (this._setpointPower < this._parameter.minWatts) {
                    this._setpointPower = this._parameter.minWatts;
                }
                if (this._setpointPower > this._parameter.maxWatts) {
                    this._setpointPower = this._parameter.maxWatts;
                }
                break;
            }

            case 'smart': {
                const isFroniusMeterDefect = this._config.froniusMeterDefect === true;
                this._mode = ControllerMode.smart;
                const p = this._parameter && this._parameter.smart;
                let msgHeader = 'mode smart (Bat ' + this._smartModeValues.eBatPercent + '%)';
                debug.finest('smart: %o %o', p, this._smartModeValues);

                if (!p) { debug.warn('no parameter available'); }
                if (!this._smartModeValues) { debug.warn('smartModeValues not availables'); }
                if (this._smartModeValues.pGridWatt === null) { debug.warn('pGridWatt not available'); }
                if (this._smartModeValues.pBatWatt === null) { debug.warn('pBatWatt not available'); }
                if (this._smartModeValues.eBatPercent === null) { debug.warn('eBatPercent not available'); }
                if (this._smartModeValues.pPvSouthWatt === null) { debug.warn('pPvSouthWatt not available'); }
                if (this._smartModeValues.pPvEastWestWatt === null) { debug.warn('pPvEastWestWatt not available'); }

                if (!this._smartModeValues || !p) {
                    debug.finer('%s: no values available => P = 0W', msgHeader);
                    this._setpointPower  = 0;

                } else if (this._smartModeValues.pGridWatt === null || this._smartModeValues.pBatWatt === null || this._smartModeValues.eBatPercent === null ||
                           this._smartModeValues.pPvSouthWatt === null || this._smartModeValues.pPvEastWestWatt === null) {
                    debug.finer('%s: some values are not available => P = 0W', msgHeader);
                    this._setpointPower  = 0;

                } else if (isFroniusMeterDefect) {
                    msgHeader += ' - fronius meter defect';
                    if (this._smartModeValues.eBatPercent < p.minEBatPercent) {
                        debug.finer('%s: fronius meter defect, battery low (< %d%\% (min) ) => P = 0W', msgHeader, p.minEBatPercent);
                        this._setpointPower = 0;
                    } else {
                        const pNotNeeded = this._smartModeValues.pPvSouthWatt + this._smartModeValues.pPvEastWestWatt + this._smartModeValues.pBatWatt
                                           - this._smartModeValues.pHeatSystemWatt - this._smartModeValues.pOthersWatt;
                        const pAvailable = pNotNeeded - (p.minWatts > 200 ? p.minWatts : 250) - this._setpointPower;
                        debug.warn('%s: availaible power = %d', msgHeader, pAvailable);
                        if (pAvailable < 0) {
                            this._setpointPower = Math.round(this._setpointPower - 100);
                            debug.finer('%s: decrease setpoint power to %dW', msgHeader, this._setpointPower);
                        } else if (pAvailable > 100) {
                            this._setpointPower = Math.round(this._setpointPower + 100);
                            debug.finer('%s: increase setpoint power to %dW', msgHeader, this._setpointPower);
                        } else {
                            debug.finer('%s: setpoint power %dW not changed', msgHeader, this._setpointPower);
                        }
                        if (this._setpointPower < 0) {
                            this._setpointPower = 0;
                        } else  if (this._setpointPower > p.maxWatts) {
                            this._setpointPower = p.maxWatts;
                        }
                        this._setpointPower = Math.round(this._setpointPower);
                    }

                } else if (this._smartModeValues.pGridWatt === null || this._smartModeValues.pBatWatt === null || this._smartModeValues.eBatPercent === null) {
                    debug.finer('%s: some values are not available => P = 0W', msgHeader);
                    this._setpointPower  = 0;

                } else {
                    if (this._smartModeValues.eBatPercent < p.minEBatPercent) {
                        msgHeader += ': battery low (< ' + p.minEBatPercent + '% (min) )';
                        this._setpointPower  = 0;

                    } else if (this._smartModeValues.eBatPercent >= 99 && this._smartModeValues.pBatWatt > 100) {
                        let dP = this._smartModeValues.pBatWatt * 0.05;
                        if  (dP > 100) { dP = 100; }
                        this._setpointPower = Math.round(this._setpointPower - dP);
                        msgHeader += ': Full battery ' + this._smartModeValues.pBatWatt + 'W discharge (>100W)';

                    } else if (this._smartModeValues.eBatPercent < 99 && this._smartModeValues.pBatWatt > 0) {
                        let dP = this._smartModeValues.pBatWatt * 0.05;
                        if  (dP > 100) { dP = 100; }
                        this._setpointPower = Math.round(this._setpointPower - dP);
                        msgHeader += ': battery ' + this._smartModeValues.pBatWatt + 'W discharge (>0W)';

                    } else if (this._smartModeValues.pBatWatt < -100) {
                        let dP = this._smartModeValues.pBatWatt * -0.01;
                        if  (dP > 100) { dP = 100; }
                        this._setpointPower = Math.round(this._setpointPower + dP);
                        msgHeader += ': battery ' + this._smartModeValues.pBatWatt + 'W charge (>100W)';

                    } else if (this._smartModeValues.pGridWatt < -50) {
                        let dP = this._smartModeValues.pGridWatt * -0.05;
                        if  (dP > 200) { dP = 200; }
                        this._setpointPower = Math.round(this._setpointPower + dP);
                        msgHeader += ': ' + ((-1) * this._smartModeValues.pGridWatt) + 'W to grid (>50W)';

                    } else if (this._smartModeValues.pGridWatt > 50) {
                        let dP = this._smartModeValues.pGridWatt * 0.05;
                        if  (dP > 100) { dP = 100; }
                        this._setpointPower = Math.round(this._setpointPower - dP);
                        msgHeader += ': ' + this._smartModeValues.pGridWatt + 'W from grid (>50W)';

                    } else {
                        msgHeader += ': no changes';
                    }

                    if (this._setpointPower < p.minWatts) {
                        this._setpointPower = p.minWatts;
                        debug.finer('mode smart: limit P => P = %dW', this._setpointPower );
                    }
                    if (this._setpointPower > p.maxWatts) {
                        this._setpointPower = p.maxWatts;
                        debug.finer('mode smart: limit P => P = %dW', this._setpointPower );
                    }
                    this._setpointPower = Math.round(this._setpointPower);
                    debug.finer('%s => P = %dW', msgHeader, this._setpointPower);
                }
                break;
            }

            case 'test': {
                this._mode = ControllerMode.test;
                this._setpointPower = 0;
                break;
            }
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
