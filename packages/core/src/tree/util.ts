export function asArray<T>(value: T | T[]): T[] {
    if (Array.isArray(value)) {
        return value;
    } else {
        return [value];
    }
}
