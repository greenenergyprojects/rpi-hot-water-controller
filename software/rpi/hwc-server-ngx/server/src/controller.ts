
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
import { ISmartModeParameter, SmartModeParameter } from './data/common/hwc/smart-mode-parameter';
import { BatStateType, ISmartModeValues, SmartModeValues } from './data/common/hwc/smart-mode-values';
import { ControllerMode } from './data/common/hwc/controller-mode';
import { IValue } from './data/common/hwc/value';
import { reverse } from 'dns';

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

    private _config:              IControllerConfig;
    private _parameter:           ControllerParameter;
    private _mode:                ControllerMode;
    private _smartModeValues:     SmartModeValues;
    private _setpointPower:       number;
    private _lastSetPointPowerAt: number;
    private _activePower:         number;
    private _energyDaily:         number;
    private _energyTotal:         number;

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

    public setSmartModeValues (source: string, values: SmartModeValues) {
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


    public calcSetpointPower (): number {
        let rv = this._setpointPower;
        if (typeof rv !== 'number' || rv < 0)  {
            debug.warn('invalid value setpointPower %s, setting to 0', );
            rv = 0;
        }

        const activePower = typeof this._setpointPower === 'number' ? this._activePower : 0.0;
        let pBat = 0;
        let pGrid = 0;
        let eBatPct = 0;
        let pPvSouth = 0;
        let pPvEastWest = 0;
        let pHeatSystem = 0;
        let pOthers = 0;
        let batState: BatStateType = 'UNKNOWN';

        const p: IControllerParameter = this._parameter ? this._parameter :
            {
                createdAt: Date.now(),
                from: 'calcSetpointPower',
                mode: ControllerMode.off,
                desiredWatts: 0,
                smart: { minEBatPercent: 100, minWatts: 0, maxWatts: 0 }
            };
        let msgHeader = '';

        if (!this._smartModeValues) {
             debug.warn('smartModeValues not availables');
        } else {
            debug.finest('%s: %o %o', p.mode, p, this._smartModeValues);
            if (typeof this._smartModeValues.pBatWatt === 'number') {
                pBat = this._smartModeValues.pBatWatt;
            } else {
                debug.warn('pBatWatt not available');
            }
            if (typeof this._smartModeValues.pGridWatt === 'number') {
                pGrid = this._smartModeValues.pGridWatt;
            } else {
                debug.warn('pGridWatt not available');
            }
            if (typeof this._smartModeValues.eBatPercent === 'number') {
                eBatPct = this._smartModeValues.eBatPercent;
            } else {
                debug.warn('eBatPercent not available');
            }
            if (typeof this._smartModeValues.pPvSouthWatt === 'number') {
                pPvSouth = this._smartModeValues.pPvSouthWatt;
            } else {
                debug.warn('pPvSouthWatt not available');
            }
            if (typeof this._smartModeValues.pPvEastWestWatt === 'number') {
                pPvEastWest = this._smartModeValues.pPvEastWestWatt;
            } else {
                debug.warn('pPvEastWestWatt not available');
            }
            if (typeof this._smartModeValues.pHeatSystemWatt === 'number') {
                pHeatSystem = this._smartModeValues.pHeatSystemWatt;
            } else {
                debug.warn('pHeatSystemWatt not available');
            }
            if (typeof this._smartModeValues.pOthersWatt === 'number') {
                pOthers = this._smartModeValues.pOthersWatt;
            } else {
                debug.warn('pOthersWatt not available');
            }
            if (this._smartModeValues.batState) {
                batState = this._smartModeValues.batState;
            }
        }

        switch (p.mode) {
            case 'off': {
                this._mode = ControllerMode.off;
                rv = 0;
                break;
            }

            case 'on': {
                this._mode = ControllerMode.on;
                msgHeader = 'mode on: P=2000W';
                rv = 2000;
                break;
            }

            case 'power': {
                this._mode = ControllerMode.power;
                const min = typeof p.minWatts === 'number' && p.minWatts >= 0 ? p.minWatts : 0;
                const max = typeof p.maxWatts === 'number' && p.maxWatts >= 0 ? p.maxWatts : 2000;
                if (typeof p.desiredWatts !== 'number') {
                    msgHeader += 'desiredWatts not valid, set power to 0W';
                    rv = 0;
                } else {
                    if (p.desiredWatts > rv) {
                        rv += 25; // step slowly high to avoid power from grid (slow battery response)
                    } else {
                        rv = p.desiredWatts;
                    }
                }
                if (rv < min) {
                    rv = min;
                }
                if (rv > max) {
                    rv = max;
                }
                msgHeader = 'mode power: desired P=' + p.desiredWatts + 'W';
                break;
            }

            case 'smart': {
                this._mode = ControllerMode.smart;
                msgHeader = 'mode smart (Bat ' + eBatPct + '%)';
                const isFroniusMeterDefect = this._config.froniusMeterDefect === true;
                if (!p || !p.smart) {
                    msgHeader += '(1.1): no parameter available => P = 0W';
                    rv  = 0;
                    break;
                }
                const pSmart: ISmartModeParameter = p.smart ? p.smart : { minEBatPercent: 100, minWatts: 0, maxWatts: 0 };
                let pbatMin = 0;
                msgHeader += ' Bat ' + batState;
                if (batState === 'FULL' || batState === 'HOLDING') {
                    pbatMin = 0;
                } else {
                    pbatMin = typeof pSmart.minPBatLoadWatts === 'number' && pSmart.minPBatLoadWatts >= 0 ? pSmart.minPBatLoadWatts : 0;
                }
                msgHeader += ' PBatMin=' +  pbatMin + 'W => ';
                if (isFroniusMeterDefect) {
                    msgHeader += ' - fronius meter defect - ';
                    if (eBatPct <= pSmart.minEBatPercent) {
                        msgHeader += '(3.1): battery low (< ' + pSmart.minEBatPercent + '% (min) )';
                        rv = 0;
                    } else {
                        const pNotNeeded = pPvSouth + pPvEastWest + pBat - pHeatSystem - pOthers - pbatMin;
                        const pAvailable = this.filterAvailablePower(pNotNeeded - (pSmart.minWatts > 250 ? pSmart.minWatts : 250) - rv);
                        msgHeader += sprintf('(4.1): availaible power = %d', pAvailable);
                        if (pAvailable < 0) {
                            rv = rv - 100;
                            msgHeader += sprintf('(4.2): decrease setpoint power to %dW', rv);
                        } else if (pAvailable > 100) {
                            rv = rv + 100;
                            msgHeader += sprintf('(4.3): increase setpoint power to %dW', rv);
                        } else {
                            msgHeader += sprintf('(4.4): setpoint power %dW not changed', rv);
                        }
                        if (rv < 0) {
                            rv = 0;
                            msgHeader += sprintf(' limit to 0W');
                        } else if (rv > pSmart.maxWatts) {
                            rv = pSmart.maxWatts;
                            msgHeader += sprintf(' limit to %dW', rv);
                        }
                    }

                } else if (eBatPct <= pSmart.minEBatPercent) {
                    msgHeader += '(6.1): battery low (< ' + pSmart.minEBatPercent + '% (min) )';
                    rv  = 0;

                } else {
                    const pAvail = this.filterAvailablePower(-pGrid - pBat - pbatMin);
                    msgHeader += ' Pavail=' + pAvail + 'W => ';

                    let dP = 0;

                    if (batState !== 'FULL' && batState !== 'HOLDING') {
                        const batStatus = (pBat < 0 ? 'charge' : 'discharge');
                        const sPower = '(Pgrid=' + pGrid + 'W, Pbat=' + pBat + 'W ' + batStatus + ')';

                        if (pGrid > 200) {
                            msgHeader += '(7.1): battery ok ' + sPower + ', decrease P (-20W)';
                            dP = -20;

                        } else if (pGrid > 100) {
                            msgHeader += '(7.2): battery ok ' + sPower + ', decrease P (-5W)';
                            dP = -5;

                        } else if (pAvail > 200) {
                            msgHeader += '(7.3): battery ok ' + sPower + ', increase P (+10W)';
                            dP = 10;

                        } else if (pAvail < -200) {
                            msgHeader += '(7.4): battery ok ' + sPower + ', decrease P (-100W)';
                            dP = -100;

                        } else if (pAvail > 30) {
                            msgHeader += '(7.5): battery ok ' + sPower + ', increase P (+5W)';
                            dP = 5;

                        } else if (pAvail < -30) {
                            msgHeader += '(7.6): battery ok ' + sPower + ', decrease P (-25)';
                            dP = -10;

                        } else if (pGrid > 10) {
                            msgHeader += '(7.7): battery ok ' + sPower + ', decrease P (-5W)';
                            dP = -5;

                        } else {
                            msgHeader += '(7.7): battery ok ' + sPower + ', no change for P';
                        }

                    } else {
                        if (pGrid > 300) {
                            msgHeader += '(8.1): decrease P (-50W)';
                            dP = -50;
                        } else if (pGrid > 100) {
                            msgHeader += '(8.2): decrease P (-10W)';
                            dP = -10;
                        } else if (pGrid > 10) {
                            msgHeader += '(8.3): decrease P (-5W)';
                            dP = -5;
                        } else if (pGrid < -10) {
                            msgHeader += '(8.4): increase P (+5W)';
                            dP = 5;
                        } else if (pGrid < -100) {
                            msgHeader += '(8.5): increase P (+10W)';
                            dP = 10;
                        } else {
                            msgHeader += '(8.6): no change for P';
                        }
                    }
                    if (dP < 0 && dP > -1 ) { dP = -1; }
                    if (dP > 0 && dP <  1 ) { dP =  1; }
                    rv += dP;
                    if (rv < pSmart.minWatts) {
                        rv = pSmart.minWatts;
                        msgHeader += '(limit to min)';
                    }
                    if (rv > pSmart.maxWatts) {
                        rv = pSmart.maxWatts;
                        msgHeader += '(limit to max)';
                    }
                }
                break;
            }

            case 'test': {
                this._mode = ControllerMode.test;
                this._setpointPower = 0;
                break;
            }
        }

        rv = Math.round(rv);
        if (msgHeader) {
            debug.finer(sprintf('Pset = %4dW -- %s', rv, msgHeader ));
        }

        return rv;
    }

    public async refresh () {
        debug.finest('refresh()): mode=%s', this._parameter.mode);

        if (this._smartModeValues) {
            if (Date.now() - this._smartModeValues.createdAt.getTime() > 60000) {
                this._smartModeValues = null;
                debug.warn('no _smartModeValues available');
            }
        }

        try {
            this._setpointPower = this.calcSetpointPower();
            this._lastSetPointPowerAt = Date.now();
        } catch (err) {
            debug.warn('calculation setpoint power fails\n%e', err);
            if (Date.now() - this._lastSetPointPowerAt > 20000) {
                debug.warn('refreshing _setpointPower fails (timeout 20s), setting to 0');
                this._setpointPower = 0;
                this._lastSetPointPowerAt = Date.now();
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

    // tslint:disable-next-line: member-ordering
    private _availPowerFilter: { a: number, ewma: number } = {
        a: 0.1,
        ewma: 0
    };

    private filterAvailablePower (p: number): number {
        // EWMA filter for available power, because fronius battery management jumpy
        const f = this._availPowerFilter;
        f.ewma = f.a * p + (1 - f.a) * (f.ewma);
        return Math.round(f.ewma);
    }



}
