import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('routers:RouterData');

import * as fs from 'fs';
import * as path from 'path';

import * as express from 'express';

import { handleError, RouterError, BadRequestError, AuthenticationError, InternalServerError } from './router-error';
import { VERSION } from '../main';
import { Monitor } from '../monitor';
import { IMonitorRecord } from '../data/common/hwc/monitor-record';
import { HotWaterController } from '../modbus/hot-water-controller';
import { ModbusDevice } from '../modbus/modbus-device';
import { Controller } from '../controller';
import { Value } from '../data/common/hwc/value';




export class Router {

    public static get Instance(): express.Router {
        if (!this._instance) {
            this._instance = new Router;
        }
        return this._instance._router;
    }

    private static _instance: Router;

    // ******************************************************

    private _router: express.Router;

    private constructor () {
        this._router = express.Router();
        this._router.get('/server/about', (req, res, next) => this.getServerAbout(req, res, next));
        this._router.get('/data/monitor', (req, res, next) => this.getMonitor(req, res, next));
        this._router.get('/controller', (req, res, next) => this.getController(req, res, next));
        this._router.post('/controller', (req, res, next) => this.postController(req, res, next));
    }

    private async getServerAbout (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            res.json({ name: 'server hwc (Hot Water Controller)', version: VERSION });
        } catch (err) {
            handleError(err, req, res, next, debug);
        }
    }

    private async getMonitor (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const rv: IMonitorRecord [] = [];
            if (req.query && Object.getOwnPropertyNames(req.query).length > 0) {
                const setPoint = req.query.setpoint;
                if (!setPoint || +setPoint < 0 || +setPoint > 20) {
                    throw new BadRequestError('invalid setpoint');
                }
                try {
                    await HotWaterController.getInstance().writeCurrent4To20mA(+setPoint);
                    await Monitor.getInstance().refresh();
                } catch (err) {
                    throw new InternalServerError('cannot set 4..24mA current setpoint', err);
                }
            }
            const r = Monitor.getInstance().lastRecord;
            if (r) {
                rv.push(r.toObject());
            }
            res.json(rv);
        } catch (err) {
            handleError(err, req, res, next, debug);
        }
    }

    private async getController (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const c = Controller.getInstance();
            if (req.query && Object.getOwnPropertyNames(req.query).length > 0) {
                let doRefresh = false;
                if (req.query.mode !== undefined) {
                    try {
                        c.setMode(req.query.mode);
                        doRefresh = true;
                    } catch (err) { throw new BadRequestError('invalid mode', err); }
                }
                if (req.query.power !== undefined) {
                    const p = +req.query.power;
                    if (!(p >= 0 && p <= 2000)) { throw new BadRequestError('invalid power'); }
                    try {
                        debug.info('GET /controller -> set power to %s', p);
                        c.setpointPower = new Value({ createdAt: Date.now(), createdFrom: 'server GET /controller', value: p, unit: 'W' });
                        doRefresh = true;
                    } catch (err) { throw new BadRequestError('invalid power', err); }
                }
                if (doRefresh) {
                    debug.info('GET /controller -> refresh');
                    await c.refresh();
                }
            }
            res.send({
                mode: c.mode,
                powerSetting: c.powerSetting.toObject(),
                activePower: c.activePower.toObject(),
                setpointPower: c.setpointPower.toObject(),
                maxPower: c.maxPower.toObject()
            });
        } catch (err) {
            handleError(err, req, res, next, debug);
        }
    }

    private async postController (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const c = Controller.getInstance();
            res.send({
                done: false,
                mode: c.mode,
                powerSetting: c.powerSetting.toObject()
            });
        } catch (err) {
            handleError(err, req, res, next, debug);
        }
    }

}
