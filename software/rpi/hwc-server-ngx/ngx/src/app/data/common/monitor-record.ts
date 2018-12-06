
import { DataRecord } from './data-record';
import { IEnergyRecord, EnergyRecord } from './energy-record';
import { ICurrent4To20mA, Current4To20mA } from './current4-to-20ma';

export interface IMonitorRecord {
    createdAt: Date | number | string;
    powerWatts: number;
    energy?: IEnergyRecord [];
    current4to20mA?: ICurrent4To20mA;
}

export class MonitorRecord extends DataRecord<IMonitorRecord> implements IMonitorRecord {

    private _createdAt: Date;
    private _powerWatts: number;
    private _energy: EnergyRecord [] = [];
    private _current4to20mA?: Current4To20mA;

    constructor (data: IMonitorRecord) {
        super(data);
        try {
            this._createdAt = DataRecord.parseDate(data, { attribute: 'createdAt', validate: true });
            this._powerWatts = DataRecord.parseNumber(data, { attribute: 'powerWatts', validate: true, min: 0 });
            if (Array.isArray(data.energy)) {
                data.energy.forEach( (element, i) => this._energy.push(new EnergyRecord(element)));
            }
            if (data.current4to20mA) {
                this._current4to20mA = new Current4To20mA(data.current4to20mA);
            }
        } catch (err) {
            throw new MonitorRecordError('parsing IMonitorRecord fails', err);
        }
    }

    public toObject (convertDate = false): IMonitorRecord {
        const rv: IMonitorRecord = {
            createdAt: convertDate ? this._createdAt.getTime() : new Date(this._createdAt.getTime()),
            powerWatts: this._powerWatts
        };
        if (this._energy.length > 0) {
            rv.energy = [];
            this._energy.forEach(element => { rv.energy.push(element.toObject(convertDate)); });
        }
        if (this._current4to20mA) {
            rv.current4to20mA = this._current4to20mA.toObject(convertDate);
        }
        return rv;
    }

    public get createdAt (): Date {
        return this._createdAt;
    }

    public get powerWatts (): number {
        return this._powerWatts;
    }

    public get energy (): EnergyRecord [] {
        return this._energy;
    }

    public get current4to20mA (): Current4To20mA {
        return this._current4to20mA;
    }

}


export class MonitorRecordError extends Error {
    constructor (msg: string, public cause?: Error) { super(msg); }
}
