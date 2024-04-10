import {
    OrderExpression,
    Source,
    Walker,
    Expression,
} from '@type-linq/query-tree';

import { Serializable, Func, Expression as AstExpression } from '../type.js';
import { Queryable } from './queryable.js';
import { parseFunction } from './parse.js';
import { processKey } from './util.js';
import { Globals } from '../convert/global.js';

export function orderBy<TElement, TKey>(
    source: Queryable<TElement>,
    key: Func<TKey, [TElement]>,
    args?: Serializable,
): Source {
    Walker.walkSource(source.expression, (exp) => {
        if (exp instanceof OrderExpression) {
            throw new Error(
                `Expression already contains an orderBy. Use thenBy to add additional ordering`
            );
        }
    });

    const keyAst = parseFunction(key, 1, args);
    const fields = processOrderKey(
        args,
        source.provider.globals,
        keyAst,
        source.expression,
    );

    let current = source.expression;
    for (const field of  fields) {
        current = new OrderExpression(
            current,
            field.expression,
            false,
        );
    }
    return current;
}

export function orderByDescending<TElement, TKey>(
    source: Queryable<TElement>,
    key: Func<TKey, [TElement]>,
    args?: Serializable,
): Source {
    Walker.walkSource(source.expression, (exp) => {
        if (exp instanceof OrderExpression) {
            throw new Error(
                `Expression already contains an orderBy. Use thenBy to add additional ordering`
            );
        }
    });

    const keyAst = parseFunction(key, 1, args);
    const fields = processOrderKey(
        args,
        source.provider.globals,
        keyAst,
        source.expression,
    );

    let current = source.expression;
    for (const field of  fields) {
        current = new OrderExpression(
            current,
            field.expression,
            true,
        );
    }
    return current;
}

export function thenBy<TElement, TKey>(
    source: Queryable<TElement>,
    key: Func<TKey, [TElement]>,
    args?: Serializable,
): Source {
    let flag = false;
    Walker.walkSource(source.expression, (exp) => {
        if (exp instanceof OrderExpression) {
            flag = true;
        }
    });

    if (flag === false) {
        throw new Error(
            `Unable to find OrderByExpression. Use orderBy for the first ordering call`
        );
    }

    const keyAst = parseFunction(key, 1, args);
    const fields = processOrderKey(
        args,
        source.provider.globals,
        keyAst,
        source.expression,
    );

    let current = source.expression;
    for (const field of  fields) {
        current = new OrderExpression(
            current,
            field.expression,
            false,
        );
    }
    return current;
}

export function thenByDescending<TElement, TKey>(
    source: Queryable<TElement>,
    key: Func<TKey, [TElement]>,
    args?: Serializable,
): Source {
    let flag = false;
    Walker.walkSource(source.expression, (exp) => {
        if (exp instanceof OrderExpression) {
            flag = true;
        }
    });

    if (flag === false) {
        throw new Error(
            `Unable to find OrderByExpression. Use orderBy for the first ordering call`
        );
    }

    const keyAst = parseFunction(key, 1, args);
    const fields = processOrderKey(
        args,
        source.provider.globals,
        keyAst,
        source.expression,
    );

    let current = source.expression;
    for (const field of  fields) {
        current = new OrderExpression(
            current,
            field.expression,
            true,
        );
    }
    return current;
}

function processOrderKey(args: Serializable, globals: Globals, expression: AstExpression<`ArrowFunctionExpression`>, ...sources: Expression[]) {
    const key = processKey(args, globals, expression, ...sources);
    if (Array.isArray(key)) {
        return key;
    }
    return [key];
}
