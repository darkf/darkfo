module Logging {
    type LogFunction = (...args: any[]) => void;

    interface ModuleLogger {
        log: LogFunction;
        info: LogFunction;
        warn: LogFunction;
        error: LogFunction;
        debug: LogFunction;
    }

    function makeLogFunction(moduleName: string, logType: string): LogFunction {
        const log = console[logType];
        
        return function(...args: any[]): void {
            args[0] = `[${moduleName}] ${args[0]}`;
            log.apply(null, args);
        };
    }

    export function logger(moduleName: string): ModuleLogger {
        return { log: makeLogFunction(moduleName, "log")
               , info: makeLogFunction(moduleName, "info")
               , warn: makeLogFunction(moduleName, "warn")
               , error: makeLogFunction(moduleName, "error")
               , debug: makeLogFunction(moduleName, "debug")
               };
    }
}
