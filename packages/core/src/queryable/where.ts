import {
    BinaryExpression,
    LogicalExpression,
    MatchExpression,
    WhereExpression,
} from '@type-linq/query-tree';
import { convert } from '../convert/convert.js';
import { Queryable } from './queryable.js';
import { Predicate, Serializable } from '../type.js';
import { parseFunction } from './parse.js';
import { Globals } from '../convert/global.js';
import { buildSources, varsName } from './util.js';

export function where<TElement, TArgs extends Serializable | undefined = undefined>(
    source: Queryable<TElement>,
    predicate: Predicate<TElement, TArgs>,
    args?: TArgs,
) {
    const ast = parseFunction(predicate, 1, args);
    const vars = varsName(ast);
    const sources = buildSources(ast, source.expression);
    const globals: Globals = source.provider.globals;

    const clause = convert(
        sources,
        ast.body,
        vars,
        globals,
        args,
    );

    // TODO: Should we accept literal true or false?
    switch (true) {
        case clause instanceof LogicalExpression:
        case clause instanceof BinaryExpression:
        case clause instanceof MatchExpression:
            break;
        default:
            throw new Error(
                `Expected the where predicate to return a LogicalExpression, ` +
                    `BinaryExpression or MatchExpression. Got ${clause.constructor.name}`
            );
    }

    const where = new WhereExpression(
        source.expression,
        clause,
    );

    return new Queryable<TElement>(
        source.provider,
        where,
    );
}

