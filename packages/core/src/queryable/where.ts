import {
    BinaryExpression,
    LogicalExpression,
    WhereExpression,
} from '@type-linq/query-tree';
import { convert } from '../convert/convert';
import { Queryable } from './queryable';
import { Predicate, Serializable } from '../type';
import { parseFunction } from './parse';
import { Globals } from '../convert/global';
import { buildSources, varsName } from './util';

export function where<TElement, TArgs extends Serializable | undefined = undefined>(
    this: Queryable<TElement>,
    predicate: Predicate<TElement, TArgs>,
    args?: TArgs,
) {
    const ast = parseFunction(predicate, 1, args);
    const vars = varsName(ast);
    const sources = buildSources(ast, this.expression);
    const globals: Globals = this.provider.globals;

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
        this.expression,
        clause,
    );
    return new Queryable<TElement>(
        this.provider,
        where,
    );
}
