import {
    OrderExpression,
    Source,
    Walker,
} from '@type-linq/query-tree';

import { Serializable, Expression as AstExpression } from '../type.js';
import { ExpressionSource, processKey } from './util.js';
import { QueryProvider } from '../query-provider.js';

export function orderBy(
    provider: QueryProvider,
    source: Source,
    keyAst: AstExpression<`ArrowFunctionExpression`>,
    args?: Serializable,
): Source {
    Walker.walkSource(source, (exp) => {
        if (exp instanceof OrderExpression) {
            throw new Error(
                `Expression already contains an orderBy. Use thenBy to add additional ordering`
            );
        }
    });

    const fields = processOrderKey(
        args,
        provider,
        keyAst,
        source,
    );

    let current = source;
    for (const field of  fields) {
        current = new OrderExpression(
            current,
            field.expression,
            false,
        );
    }
    return current;
}

export function orderByDescending(
    provider: QueryProvider,
    source: Source,
    keyAst: AstExpression<`ArrowFunctionExpression`>,
    args?: Serializable,
): Source {
    Walker.walkSource(source, (exp) => {
        if (exp instanceof OrderExpression) {
            throw new Error(
                `Expression already contains an orderBy. Use thenBy to add additional ordering`
            );
        }
    });

    const fields = processOrderKey(
        args,
        provider,
        keyAst,
        source,
    );

    let current = source;
    for (const field of  fields) {
        current = new OrderExpression(
            current,
            field.expression,
            true,
        );
    }
    return current;
}

export function thenBy(
    provider: QueryProvider,
    source: Source,
    keyAst: AstExpression<`ArrowFunctionExpression`>,
    args?: Serializable,
): Source {
    let flag = false;
    Walker.walkSource(source, (exp) => {
        if (exp instanceof OrderExpression) {
            flag = true;
        }
    });

    if (flag === false) {
        throw new Error(
            `Unable to find OrderByExpression. Use orderBy for the first ordering call`
        );
    }

    const fields = processOrderKey(
        args,
        provider,
        keyAst,
        source,
    );

    let current = source;
    for (const field of  fields) {
        current = new OrderExpression(
            current,
            field.expression,
            false,
        );
    }
    return current;
}

export function thenByDescending(
    provider: QueryProvider,
    source: Source,
    keyAst: AstExpression<`ArrowFunctionExpression`>,
    args?: Serializable,
): Source {
    let flag = false;
    Walker.walkSource(source, (exp) => {
        if (exp instanceof OrderExpression) {
            flag = true;
        }
    });

    if (flag === false) {
        throw new Error(
            `Unable to find OrderByExpression. Use orderBy for the first ordering call`
        );
    }

    const fields = processOrderKey(
        args,
        provider,
        keyAst,
        source,
    );

    let current = source;
    for (const field of  fields) {
        current = new OrderExpression(
            current,
            field.expression,
            true,
        );
    }
    return current;
}

function processOrderKey(args: Serializable, provider: QueryProvider, expression: AstExpression<`ArrowFunctionExpression`>, ...sources: ExpressionSource[]) {
    const key = processKey(args, provider, expression, ...sources);
    if (Array.isArray(key)) {
        return key;
    }
    return [key];
}
