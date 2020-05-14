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
import { Controller } from '../controller';
import { Server } from '../server';
import { ControllerParameter, IControllerParameter } from '../data/common/hwc/controller-parameter';
import { SmartModeValues, ISmartModeValues } from '../data/common/hwc/smart-mode-values';
import { IModbusSerialDeviceResetConfig } from '../modbus/modbus-serial-device';




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
        this._router.get('/monitor', (req, res, next) => this.getMonitor(req, res, next));
        this._router.post('/controller/parameter', (req, res, next) => this.postControllerParameter(req, res, next));
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
                debug.finer('monitor: query=%o', req.query);
                const ctrl = Controller.getInstance();
                const x: ISmartModeValues = {
                    createdAt:       null,
                    eBatPercent:     null,
                    pBatWatt:        null,
                    pGridWatt:       null,
                    pPvSouthWatt:    null,
                    pPvEastWestWatt: null,
                    pHeatSystemWatt: null,
                    pOthersWatt:     null
                };
                for (const att of Object.getOwnPropertyNames(x)) {
                    let v: number | string | undefined = req.query[att];
                    if (att === 'createdAt' && typeof v === 'string') {
                        v = +v;
                    } else if (typeof v !== 'string') {
                        switch (att) {
                            case 'createdAt':       v = Date.now(); break;
                            case 'eBatPercent':     v = null; break;
                            case 'pBatWatt':        v = '0'; break;
                            case 'pGridWatt':       v = '0'; break;
                            case 'pPvSouthWatt':    v = '0'; break;
                            case 'pPvEastWestWatt': v = '0'; break;
                            case 'pHeatSystemWatt': v = '0'; break;
                            case 'pOthersWatt':     v = '0'; break;
                            default: v = null;
                        }
                    }
                    (x as any)[att] = v;
                }
                const smv = new SmartModeValues(x);
                ctrl.setSmartModeValues(smv);
            }
            const r = Monitor.getInstance().lastRecord;
            if (r) {
                rv.push(r.toObject());
            }
            // debug.fine('--> getMonitor():\n%o', rv);
            res.json(rv);
        } catch (err) {
            handleError(err, req, res, next, debug);
        }
    }

    // private async getController (req: express.Request, res: express.Response, next: express.NextFunction) {
    //     try {
    //         const c = Controller.getInstance();
    //         if (req.query && Object.getOwnPropertyNames(req.query).length > 0) {
    //             let doRefresh = false;
    //             if (req.query.mode !== undefined) {
    //                 try {
    //                     c.setMode(req.query.mode);
    //                     doRefresh = true;
    //                 } catch (err) { throw new BadRequestError('invalid mode', err); }
    //             }
    //             if (req.query.power !== undefined) {
    //                 const p = +req.query.power;
    //                 if (!(p >= 0 && p <= 2000)) { throw new BadRequestError('invalid power'); }
    //                 try {
    //                     debug.info('GET /controller -> set power to %s', p);
    //                     c.setpointPower = new Value({ createdAt: Date.now(), createdFrom: 'server GET /controller', value: p, unit: 'W' });
    //                     doRefresh = true;
    //                 } catch (err) { throw new BadRequestError('invalid power', err); }
    //             }
    //             if (doRefresh) {
    //                 debug.info('GET /controller -> refresh');
    //                 await c.refresh();
    //             }
    //         }
    //         debug.fine('--> Controller:\n%o', c);
    //         // res.send({
    //         //     mode: c.mode,
    //         //     powerSetting: c.powerSetting.toObject(),
    //         //     activePower: c.activePower.toObject(),
    //         //     setpointPower: c.setpointPower.toObject(),
    //         //     maxPower: c.maxPower.toObject()
    //         // });
    //         res.send(c.toObject());
    //     } catch (err) {
    //         handleError(err, req, res, next, debug);
    //     }
    // }

    private async postControllerParameter (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const c = Controller.getInstance();
            debug.info('POST /controller...\n%o', req.body);
            if (!req.body.pin) { throw new AuthenticationError('missing pin'); }
            if (!Server.getInstance().isPinOK(req.body.pin)) { throw new AuthenticationError('wrong pin'); }
            delete req.body.pin;
            const data: IControllerParameter = req.body;
            // const p = new ControllerParameter(data);
            const rv = await c.setParameter(data);
            debug.info('POST /controller => %o', rv);
            res.send(rv.toObject());
        } catch (err) {
            handleError(err, req, res, next, debug);
        }
    }

}
