import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('routers:RouterData');

import * as fs from 'fs';
import * as path from 'path';

import * as express from 'express';

import { handleError, RouterError, BadRequestError, AuthenticationError, InternalServerError } from './router-error';
import { VERSION } from '../main';
import { Monitor } from '../monitor';
import { IMonitorRecord } from '../data/common/monitor-record';
import { HotWaterController } from '../modbus/hot-water-controller';
import { ModbusDevice } from '../modbus/modbus-device';




export class RouterData {

    public static get Instance(): express.Router {
        if (!this._instance) {
            this._instance = new RouterData;
        }
        return this._instance._router;
    }

    private static _instance: RouterData;

    // ******************************************************

    private _router: express.Router;

    private constructor () {
        this._router = express.Router();
        this._router.get('/server/about', (req, res, next) => this.getServerAbout(req, res, next));
        this._router.get('/monitor', (req, res, next) => this.getMonitor(req, res, next));
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

}
