import { readName } from '../convert/util';
import { SelectExpression, SourceExpression } from '../tree';
import { Expression, ExpressionType } from '../tree/expression';
import { Expression as AstExpression } from '../type';

export function buildSources(ast: AstExpression<`ArrowFunctionExpression`>, ...sources: Expression<ExpressionType>[]) {
    return sources.reduce(
        (result, source, index) => {
            const name = ast.params.length > index ?
                readName(ast.params[index]) as string :
                undefined;

            if (name === undefined) {
                return result;
            }

            result[name] = source;
            return result;
        },
        { } as Record<string, Expression<ExpressionType>>
    );
}

export function varsName(ast: AstExpression<`ArrowFunctionExpression`>) {
    const lastParam = ast.params.at(-1);
    if (lastParam === undefined) {
        return undefined;
    }

    if (lastParam.type !== `Identifier`) {
        return undefined;
    }

    return lastParam.name as string;
}

export function expressionSource(expression: SelectExpression | SourceExpression) {
    if (expression instanceof SourceExpression) {
        return expression;
    } else if (expression.source instanceof SourceExpression) {
        return expression.source;
    } else if (expression.source instanceof SelectExpression) {
        return expressionSource(expression.source);
    } else {
        throw new Error(`Expected only SelectExpression or SourceExpression`);
    }
}

export function replaceSource(expression: SelectExpression | SourceExpression, replace: (existing: SourceExpression) => SourceExpression) {
    if (expression instanceof SourceExpression) {
        return replace(expression);
    } else if (expression instanceof SelectExpression) {
        return replaceSource(expression.source, replace);
    } else {
        throw new Error(`Expected only SelectExpression or SourceExpression.`);
    }
}
