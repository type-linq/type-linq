import {
    Alias,
    BinaryExpression,
    Expression,
    LogicalExpression,
    Walker,
    WhereExpression,
} from '@type-linq/query-tree';
import { convert } from '../convert/convert.js';
import { Queryable } from './queryable.js';
import { Predicate, Serializable } from '../type.js';
import { parseFunction } from './parse.js';
import { Globals } from '../convert/global.js';
import { buildSources, varsName } from './util.js';

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
        stripAlias(clause) as LogicalExpression | BinaryExpression,
    );
    return new Queryable<TElement>(
        this.provider,
        where,
    );
}

function stripAlias(expression: Expression) {
    return Walker.walkMutate(expression, (exp) => {
        if (exp instanceof Alias) {
            return exp.expression;
        } else {
            return exp;
        }
    });
}
