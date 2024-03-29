import {
    BinaryExpression,
    LogicalExpression,
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

    // The where expression. This is the first parmeter
    // TODO: Why are the identifiers coming out of here not fully qualified?
    const clause = convert(
        sources,
        ast.body,
        vars,
        globals,
        args,
    );

    // TODO: Should we accept literal true or false?
    if (clause instanceof LogicalExpression === false && clause instanceof BinaryExpression === false) {
        throw new Error(`Expected the where predicate to return a LogicalExpression or BinaryExpression. Got ${clause.constructor.name}`);
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

