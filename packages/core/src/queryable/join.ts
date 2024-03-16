import {
    Alias,
    AliasSource,
    Expression,
    JoinClause,
    JoinExpression,
    SelectExpression,
} from '@type-linq/query-tree';

import { convert } from '../convert/convert';
import { readName } from '../convert/util';
import { Queryable } from './queryable';
import { Expression as AstExpression } from '../type';
import { Merge, Map as ValueMap, Serializable, ExpressionTypeKey } from '../type';
import { parseFunction } from './parse';
import { Globals } from '../convert/global';
import { SCALAR_NAME, transformSelect } from './select';
import { asArray, buildSources, varsName } from './util';

// TODO: Add override that will take inner and 2 functions...
//  1. A function that will return a logical expression used to join
//  2. A result selector

export function join<TOuter, TInner, TKey, TResult, TArgs extends Serializable | undefined = undefined>(
    this: Queryable<TOuter>,
    inner: Queryable<TInner>,
    outerKey: ValueMap<TOuter, TKey>,
    innerKey: ValueMap<TInner, TKey>,
    result: Merge<TOuter, TInner, TResult>,
    args?: TArgs,
): Queryable<TResult> {

    const outerExpression = this.expression;
    const innerExpression = inner.expression;

    const outerAst = parseFunction(outerKey, 1, args);
    const innerAst = parseFunction(innerKey, 1, args);
    const resultAst = parseFunction(result, 2, args);

    const globals: Globals = this.provider.globals;

    const outerColumns = processKey(outerAst, outerExpression);
    const innerColumns = processKey(innerAst, innerExpression);

    if (Array.isArray(outerColumns) !== Array.isArray(innerColumns)) {
        throw new Error(`The inner and outer keys returned incompatible result types`);
    }

    if (Array.isArray(outerColumns) && outerColumns.length !== (innerColumns as unknown[]).length) {
        throw new Error(`The inner and outer keys returned different number of columns to match on`);
    }

    const clauses = asArray(outerColumns).map(
        (outer, index) => new JoinClause(
            outer.expression,
            asArray(innerColumns)[index].expression,
        )
    );

    const joinExpression = new JoinExpression(
        outerExpression,
        innerExpression,
        clauses
    );

    // Check if join exists
    const existing = Expression.walkBranchFind(outerExpression, (exp) => {
        if (exp instanceof JoinExpression === false) {
            return false;
        }

        // Check if everything except the source matches (since it is in
        //  the same branch, the underlying source is the same)
        return innerExpression.isEqual(joinExpression, `source`);
    });

    let source = outerExpression;
    if (!existing) {
        source = joinExpression;

        const from = Expression.source(joinExpression.joined);
        const froms = Expression.sources(outerExpression).filter(
            (f) => f.entity.name === from.entity.name
        );

        if (froms.length) {
            source  = new JoinExpression(
                joinExpression.source,
                new AliasSource(
                    joinExpression.joined,
                    `${from.entity.name}_${froms.length}`
                ),
                joinExpression.join,
            );
        }
    }

    // Apply the select
    const fields = transformSelect(
        [source, innerExpression],
        resultAst,
        this.provider.globals,
    );

    const select = new SelectExpression(source, fields);
    return new Queryable<TResult>(
        this.provider,
        select,
    );

    function processKey(expression: AstExpression<`ArrowFunctionExpression`>, ...sources: Expression[]) {
        const sourceMap = buildSources(expression, ...sources);
        const vars = varsName(expression);

        switch (expression.body.type) {
            case `ArrayExpression`:
                return expression.body.elements.map(
                    (element, index) => processKeyValue(element, String(index), vars, sourceMap)
                );
            case `ObjectExpression`:
                return expression.body.properties.map(
                    (property) => {
                        if (property.type !== `Property`) {
                            throw new Error(`Expected ObjectExpression.properties to all be "Property" Expressions`);
                        }
                        const name = readName(property.key) as string;
                        return processKeyValue(property.value, name, vars, sourceMap);
                    }
                );
            default:
                return processKeyValue(expression.body, SCALAR_NAME, vars, sourceMap);
        }
    }

    function processKeyValue(
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

        return new Alias(
            converted,
            name,
        );
    }
}
