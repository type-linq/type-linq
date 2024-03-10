import { Expression, ExpressionTypeKey } from '../../../core/src/type';

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

export function isSymbolCallExpression(expression: Expression<ExpressionTypeKey>) {
    return (
        expression.type === `CallExpression` && 
        expression.callee.type === `MemberExpression` &&
        expression.callee.property.type === `Identifier` &&
        typeof expression.callee.property.name === `symbol`
    );
}

export function memberExpressionRoot(expression: Expression<ExpressionTypeKey>): Expression<ExpressionTypeKey> {
    if (expression.type !== `MemberExpression`) {
        return expression;
    }
    return memberExpressionRoot(expression.object);
}
