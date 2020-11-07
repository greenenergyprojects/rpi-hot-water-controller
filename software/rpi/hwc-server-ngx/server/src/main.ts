export const VERSION = '0.8.1';

import * as nconf from 'nconf';
import * as fs from 'fs';
import * as path from 'path';

import * as git from './utils/git';

process.on('unhandledRejection', (reason, p) => {
    const now = new Date();
    console.log(now.toLocaleDateString() + '/' + now.toLocaleTimeString() + ': unhandled rejection at: Promise', p, 'reason:', reason);
});



// ***********************************************************
// configuration, logging
// ***********************************************************

nconf.argv().env();
const configFilename = path.join(__dirname, '../config.json');
try {
    fs.accessSync(configFilename, fs.constants.R_OK);
    nconf.file(configFilename);
} catch (err) {
    console.log('Error on config file ' + configFilename + '\n' + err);
    process.exit(1);
}

let debugConfig: any = nconf.get('debug');
if (!debugConfig) {
    debugConfig = { enabled: '*::*' };
}
for (const a in debugConfig) {
    if (debugConfig.hasOwnProperty(a)) {
        const name: string = (a === 'enabled') ? 'DEBUG' : 'DEBUG_' + a.toUpperCase();
        if (!process.env[name] && (debugConfig[a] !== undefined || debugConfig[a] !== undefined)) {
            process.env[name] = debugConfig[a] ? debugConfig[a] : debugConfig[a];
        }
    }
}

// logging with debug-sx/debug
import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('main');

// debugsx.addHandler(debugsx.createConsoleHandler('stdout'));
debugsx.addHandler(debugsx.createRawConsoleHandler());

const logfileConfig = nconf.get('logfile');
if (logfileConfig) {
    for (const att in logfileConfig) {
        if (!logfileConfig.hasOwnProperty(att)) { continue; }
        const logHandlerConfig = logfileConfig[att];
        if (logHandlerConfig.disabled) { continue; }
        const h = debugsx.createFileHandler( logHandlerConfig);
        console.log('Logging ' + att + ' to ' + logHandlerConfig.filename);
        debugsx.addHandler(h);
    }
}


// ***********************************************************
// startup of application
//   ... things to do before server can be started
// ***********************************************************

import { sprintf } from 'sprintf-js';
import { Server } from './server';
import { ModbusDevice, IModbusDeviceConfig } from './modbus/modbus-device';
import { IModbusSerialDeviceConfig, ModbusSerialDevice } from './modbus/modbus-serial-device';
import { HotWaterController } from './modbus/hot-water-controller';
import { ModbusSerial, IModbusSerialConfig } from './modbus/modbus-serial';
import { Controller } from './controller';
import { Monitor } from './monitor';
import { Statistics } from './statistics';
import { Gpio } from './modbus/gpio';


const modbusSerials: ModbusSerial [] = [];
let monitor: Monitor;
const serialDevices: { [ device: string]: ModbusSerialDevice [] } = {};

// debugger;
doStartup();

async function doStartup () {
    // debug.info('delay for start' + VERSION);
    // await Gpio.delayMillis(5000);
    debug.info('Start hwc-webserver-ngx V' + VERSION);
    debug.info('Executed from: %s', __dirname);
    try {
        if (nconf.get('git')) {
            const gitInfo = await git.getGitInfo();
            startupPrintVersion(gitInfo);
        }

        const modbusConfig: { serial: IModbusSerialConfig [], devices: IModbusDeviceConfig [] } = nconf.get('modbus');
        if (modbusConfig && Array.isArray(modbusConfig.serial)) {
            modbusConfig.serial.forEach( cfg => {
                if (!cfg.disabled) {
                    modbusSerials.push(new ModbusSerial(cfg));
                }
            });
        }
        if (modbusConfig && Array.isArray(modbusConfig.devices)) {
            for (const cfg of modbusConfig.devices) {
                if (!cfg.disabled) {
                    switch (cfg.class) {
                        case 'HotWaterController': {
                            const scfg = <IModbusSerialDeviceConfig>cfg;
                            const serial = modbusSerials.find( item => item.config.device === scfg.serialDevice);
                            if (!serial) { throw new Error('serial ' + scfg.serialDevice + ' not defined'); }
                            const d = await HotWaterController.createInstance(serial, scfg);
                            ModbusDevice.addInstance(d);
                            if (!serialDevices[serial.device]) {
                                serialDevices[serial.device] = [];
                            }
                            serialDevices[serial.device].push(d);
                            break;
                        }
                        default: throw new Error('invalid class for modbus device configuration');
                    }
                }
            }
        }
        // modbusSerial = new ModbusSerial(nconf.get('modbus'));
        // const fm = new HotWaterController(modbusSerial, 1);
        // // fm.on('update', appendToHistoryFile);
        // ModbusDevice.addInstance(fm);

        const startPar = startupParallel();
        await Statistics.createInstance();
        await startupInSequence();
        await startPar;
        await startupServer();
        doSomeTests();
        process.on('SIGINT', () => {
            console.log('...caught interrupt signal');
            shutdown('interrupt signal (CTRL + C)').catch( (err) => {
                console.log(err);
                process.exit(1);
            });
        });
        debug.info('startup finished, enter now normal running mode.');

    } catch (err) {
        console.log(err);
        console.log('-----------------------------------------');
        console.log('Error: exit program');
        process.exit(1);
    }
}

// setTimeout( () => { modbus.close(); }, 5000);

// ***********************************************************
// startup and shutdown functions
// ***********************************************************

async function shutdown (src: string): Promise<void> {
    debug.info('starting shutdown ... (caused by %s)', src || '?');
    const shutdownMillis = +nconf.get('shutdownMillis');
    const timer = setTimeout( () => {
        console.log('Some jobs hanging? End program with exit code 1!');
        process.exit(1);
    }, shutdownMillis > 0 ? shutdownMillis : 500);
    let rv = 0;

    try { await Controller.getInstance().shutdown(); } catch (err) { rv++; console.log(err); }
    debug.finer('controller shutdown done');

    try { await Server.getInstance().stop(); } catch (err) { rv++; console.log(err); }
    debug.finer('monitor shutdown done');

    try { await monitor.shutdown(); } catch (err) { rv++; console.log(err); }
    debug.finer('monitor shutdown done');

    for (const ms of modbusSerials) {
        try {
            await ms.close();
        } catch (err) {
            rv++; console.log(err);
        }
    }
    debug.finer('modbusSerial shutdown done');

    try { await Gpio.shutdown(); } catch (err) { rv++; console.log(err); }
    debug.finer('gpio shutdown done');

    clearTimeout(timer);
    debug.info('shutdown successfully finished');
    process.exit(rv);
}

function startupPrintVersion (info?: git.GitInfo) {
    console.log('main.ts Version ' + VERSION);
    if (info) {
        console.log('GIT: ' + info.branch + ' (' + info.hash + ')');
        const cnt = info.modified.length;
        console.log('     ' + (cnt === 0 ? 'No files modified' : cnt + ' files modified'));
    }
}

async function startupParallel (): Promise<any []> {
    const p: Promise<any> [] = [];
    Promise.all(p).then( () => { debug.info('startupParallel finished'); });
    return p;
}

async function startupInSequence (): Promise<any []> {
    const rv: Promise<any> [] = [];
    let p: Promise<any>;
    for (const ms of modbusSerials) {
        p = ms.open(serialDevices[ms.device]); await p; rv.push(p);
    }
    p = Controller.createInstance(); await p; rv.push(p);
    await Controller.getInstance().start();
    p = Monitor.createInstance(); monitor = await p; rv.push(p);
    debug.info('startupInSequence finished');
    return rv;
}

async function startupServer (): Promise<void> {
    const configServer = nconf.get('server');
    if (configServer && configServer.start) {
        await Server.getInstance().start();
    }
}

async function startupShutdown (src?: string): Promise<void> {
    const shutdownMillis = +nconf.get('shutdownMillis');
    if (shutdownMillis > 0) {
        setTimeout( () => {
            shutdown(src ? src : 'startupShutdown').then( () => {
                console.log('shutdown successful');
                process.exit(0);
            }).catch( err => {
                console.log(err);
                console.log('shutdown fails');
                process.exit(1);
            });
        }, shutdownMillis);
        debug.info('startupShutdown finished, shutdown in ' + (shutdownMillis / 1000) + ' seconds.');
    }
}

async function doSomeTests () {
    try {
        // const d = ModbusDevice.getInstance('hwc:1');
        // if (d instanceof HotWaterController) {
        //     await d.writeCurrent4To20mA(20);
        //     await d.readCurrent4To20mA();
        //     debug.info('current read done -> %s', sprintf('%.1f%s', d.current4To20mA.value, d.current4To20mA.unit));
        // }
    } catch (err) {
        debug.warn(err);
    }
    return;
}
