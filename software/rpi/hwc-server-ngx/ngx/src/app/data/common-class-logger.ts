
export class CommonClassLogger {

    public static info (src: any, msg: string) {
        console.log('INFO', msg, src);
    }

    public static warn (src: any, msg: string) {
        console.log('WARNING', msg, src);
    }

}
