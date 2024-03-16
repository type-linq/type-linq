import { Expression } from '@type-linq/query-tree';
import { readName } from '../convert/util';
import { Expression as AstExpression } from '../type';

export function buildSources(ast: AstExpression<`ArrowFunctionExpression`>, ...sources: Expression[]) {
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
        { } as Record<string, Expression>
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

export function asArray<T>(value: T | T[]): T[] {
    if (Array.isArray(value)) {
        return value;
    } else {
        return [value];
    }
}
