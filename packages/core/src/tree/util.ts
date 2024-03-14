import { JoinExpression } from './index';

export function asArray<T>(value: T | T[]): T[] {
    if (Array.isArray(value)) {
        return value;
    } else {
        return [value];
    }
}

export function joinExists(joins: JoinExpression[], join: JoinExpression) {
    for (const existing of joins) {
        if (join.isEqual(existing)) {
            return true;
        }
    }
    return false;
}
