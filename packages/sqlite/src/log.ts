export const log = {
    level: `debug`,
    debug: (...args: unknown[]) => logWithLevel(`debug`, ...args),
    info: (...args: unknown[]) => logWithLevel(`info`, ...args),
    warn: (...args: unknown[]) => logWithLevel(`warn`, ...args),
    error: (...args: unknown[]) => logWithLevel(`error`, ...args),
}

const levels = Object.keys(log).filter((key) => key !== `level`);

function logWithLevel(level: string, ...args: unknown[]) {
    if (levels.indexOf(log.level) > levels.indexOf(level)) {
        return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (console as any)[level](...args);
}
