import {
    BinaryExpression,
    LogicalExpression,
    MatchExpression,
    Source,
    WhereExpression,
} from '@type-linq/query-tree';
import { convert } from '../convert/convert.js';
import { Expression as AstExpression, Serializable } from '../type.js';
import { Globals } from '../convert/global.js';
import { buildSources, varsName } from './util.js';
import { QueryProvider } from '../query-provider.js';

export function where<TArgs extends Serializable | undefined = undefined>(
    provider: QueryProvider,
    source: Source,
    predicateAst: AstExpression<`ArrowFunctionExpression`>,
    args?: TArgs,
) {
    const vars = varsName(predicateAst);
    const sources = buildSources(predicateAst, source);
    const globals: Globals = provider.globals;

    const clause = convert(
        sources,
        predicateAst.body,
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
        source,
        clause,
    );

    return where;
}

