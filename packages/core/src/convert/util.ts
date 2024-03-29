import { Expression, ExpressionTypeKey } from '../type.js';

export function readName(expression: Expression<ExpressionTypeKey>) {
    if (expression.type !== `Identifier` && expression.type !== `Literal`) {
        throw new Error(`Expected expression to be Identifier or Literal`);
    }
    if (expression.type === `Identifier`) {
        return expression.name;
    } else {
        return String(expression.value);
    }
}

export function randString(length?: number) {
    const result = Math.random().toString(36).substring(2);
    if (length as number > 0) {
        return result.substring(0, length);
    }
    return result;
}
