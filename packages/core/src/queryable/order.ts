import {
    Expression,
    Field,
    OrderExpression,
    Source,
    Walker
} from '@type-linq/query-tree';

import { convert } from '../convert/convert.js';
import { readName } from '../convert/util.js';
import { Serializable, Map as ValueMap, Expression as AstExpression, ExpressionTypeKey } from '../type.js';
import { Queryable } from './queryable.js';
import { buildSources, varsName } from './util.js';
import { SCALAR_NAME } from './select.js';
import { Globals } from '../convert/global.js';
import { parseFunction } from './parse.js';

// TODO: Seems some of the fields after this order by have linked entity expressions?

export function orderBy<TElement, TKey>(
    source: Queryable<TElement>,
    key: ValueMap<TElement, TKey>,
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
    const fields = processKey(
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
    key: ValueMap<TElement, TKey>,
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
    const fields = processKey(
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
    key: ValueMap<TElement, TKey>,
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
    const fields = processKey(
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
    key: ValueMap<TElement, TKey>,
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
    const fields = processKey(
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

function processKey(
    args: Serializable | undefined,
    globals: Globals | undefined,
    expression: AstExpression<`ArrowFunctionExpression`>,
    ...sources: Expression[]
): Field[] {
    const sourceMap = buildSources(expression, ...sources);
    const vars = varsName(expression);

    switch (expression.body.type) {
        case `ArrayExpression`:
            return expression.body.elements.map(
                (element, index) => processKeyValue(args, globals, element, String(index), vars, sourceMap)
            );
        case `ObjectExpression`:
            return expression.body.properties.map(
                (property) => {
                    if (property.type !== `Property`) {
                        throw new Error(`Expected ObjectExpression.properties to all be "Property" Expressions`);
                    }
                    const name = readName(property.key) as string;
                    return processKeyValue(args, globals, property.value, name, vars, sourceMap);
                }
            );
        default: {
            let name: string;
            switch (expression.body.type) {
                case `MemberExpression`:
                    name = readName(expression.body.property) as string;
                    break;
                case `Literal`:
                    name = String(expression.body.value);
                    break;
                default:
                    name = SCALAR_NAME;
                    break;
            }
            return [processKeyValue(args, globals, expression.body, name, vars, sourceMap)];
        }
    }
}

function processKeyValue(
    args: Serializable | undefined,
    globals: Globals | undefined,
    expression: AstExpression<ExpressionTypeKey>,
    name: string,
    varsName: string | undefined,
    sources: Record<string, Expression>,
) {
    switch (expression.type) {
        case `Identifier`:
        case `MemberExpression`:
        case `CallExpression`:
        case `Literal`:
        case `TemplateLiteral`:
            break;
        default:
            throw new Error(`Unsupported column Expression.type "${expression.type}"`);
    }

    const converted = convert(
        sources,
        expression,
        varsName,
        globals,
        args,
    );

    return new Field(converted, name);
}