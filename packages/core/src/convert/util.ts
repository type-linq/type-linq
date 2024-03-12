import { Expression, ExpressionTypeKey } from '../type';

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

export function randString() {
    return Math.random().toString(36).substring(2);
}
