export function randString(length?: number) {
    const result = Math.random().toString(36).substring(2);
    if (length as number > 0) {
        return result.substring(0, length);
    }
    return result;
}

export type LateBound<T> = T | (() => T);

export function lateBound<T>(value: T | (() => T)) {
    if (value instanceof Function === false) {
        return () => value;
    }

    let result: undefined | T = undefined;

    return () => {
        if (result !== undefined) {
            return result as T;
        }

        result = value();

        if (result === undefined) {
            throw new Error(`Unable to get late bound value`);
        }

        return result as T;
    }
}
