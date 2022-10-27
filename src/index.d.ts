import hato from 'hato';

export as namespace hatoLogging;

type LogLevel = 'debug' | 'info' | 'warn';
type LogTransform = (level: LogLevel, struct: object, msg: string) => void;
type Logger = {
    [key in LogLevel]: (struct: object, msg: string) => void;
};

type Options = LogTransform | { log?: LogTransform, logger?: Logger };
declare const Plugin: hato.Plugins.Plugin<Options>;

export = Plugin;
