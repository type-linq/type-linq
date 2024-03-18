import { expressionKeys, Expression, ExpressionTypeKey } from './type.js';

export function walk(expression: Expression<ExpressionTypeKey>, visit: (expression: Expression<ExpressionTypeKey>) => boolean) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exp = expression as any;

    if (visit(expression) === false) {
        return;
    }

    const keys = expressionKeys[expression.type];
    for (const key of keys) {
        if (Array.isArray(exp[key])) {
            for (const subExpression of exp[key]) {
                walk(subExpression, visit);
            }
        } else {
            walk(exp[key], visit);
        }
    }
}

export function walkLeaf(expression: Expression<ExpressionTypeKey>, visit: (expression: Expression<ExpressionTypeKey>) => void) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exp = expression as any;
    const keys = expressionKeys[expression.type];
    for (const key of keys) {
        if (Array.isArray(exp[key])) {
            for (const subExpression of exp[key]) {
                walkLeaf(subExpression, visit);
            }
        } else {
            walkLeaf(exp[key], visit);
        }
    }
    visit(expression);
}

export function mutateWalk(expression: Expression<ExpressionTypeKey>, visit: (expression: Expression<ExpressionTypeKey>) => Expression<ExpressionTypeKey>) {
    const visited = visit(expression);
    if (visited !== expression) {
        return visited;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exp = { ...expression } as any;

    for (const key of expressionKeys[expression.type]) {
        if (Array.isArray(exp[key])) {
            exp[key] = exp[key].map((exp: Expression<ExpressionTypeKey>) => mutateWalk(exp, visit))
        } else {
            exp[key] = mutateWalk(exp[key], visit);
        }
    }

    return exp;
}

export function expressionRoot(expression: Expression<ExpressionTypeKey>): Expression<ExpressionTypeKey> {
    switch (expression.type) {
        case `MemberExpression`:
            return expressionRoot(expression.object);
        case `CallExpression`:
            return expressionRoot(expression.callee);
        default:
            return expression;
    }
}
