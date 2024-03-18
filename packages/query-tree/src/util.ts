import { Expression } from './expression.js';
import { Alias, EntityIdentifier, FieldIdentifier } from './identifier.js';
import { JoinExpression } from './source/join.js';

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

export function readName(expression: Alias<Expression> | FieldIdentifier | EntityIdentifier) {
    if (expression instanceof FieldIdentifier) {
        return expression.name;
    } else if (expression instanceof EntityIdentifier) {
        return expression.name;
    } else {
        return expression.alias;
    }
}
