import {
    Expression,
    SelectExpression,
    Walker,
    BinaryExpression,
    Field,
    LogicalExpression,
    JoinExpression,
    Source,
    EntitySource,
} from '@type-linq/query-tree';

import { convert } from '../convert/convert.js';
import { readName } from '../convert/util.js';
import { Expression as AstExpression } from '../type.js';
import { Merge, Map as ValueMap, Serializable, ExpressionTypeKey } from '../type.js';
import { parseFunction } from './parse.js';
import { Globals } from '../convert/global.js';
import { SCALAR_NAME, transformSelect } from './select.js';
import { buildSources, varsName } from './util.js';
import { Queryable } from './queryable.js';

// TODO: Add override that will take inner and 2 functions...
//  1. A function that will return a logical expression used to join
//  2. A result selector

export function join<TOuter, TInner, TKey, TResult, TArgs extends Serializable | undefined = undefined>(
    outer: Queryable<TOuter>,
    inner: Queryable<TInner>,
    outerKey: ValueMap<TOuter, TKey>,
    innerKey: ValueMap<TInner, TKey>,
    result: Merge<TOuter, TInner, TResult>,
    args?: TArgs,
): Source {
    if (outer.provider !== inner.provider) {
        throw new Error(`Must join sources with the same provider`);
    }

    const outerExpression = outer.expression;
    const innerExpression = inner.expression;

    const outerAst = parseFunction(outerKey, 1, args);
    const innerAst = parseFunction(innerKey, 1, args);
    const resultAst = parseFunction(result, 2, args);

    const globals: Globals = outer.provider.globals;

    const outerColumns = processKey(outerAst, outerExpression);
    const innerColumns = processKey(innerAst, innerExpression);

    const condition = createJoinClause(outerColumns, innerColumns);

    let innerSource = Walker.find(innerExpression, (exp) => exp instanceof SelectExpression) as SelectExpression | undefined;
    if (innerSource === undefined) {
        if (innerExpression instanceof EntitySource) {
            innerSource = innerExpression;
        }
    }

    if (innerSource === undefined) {
        throw new Error(`Unable to find a select expression`);
    }

    const joinExpression = new JoinExpression(
        outerExpression,
        innerSource.entity,
        condition,
    );

    const fieldSet = transformSelect(
        [outerExpression, innerExpression],
        resultAst,
        outer.provider.globals,
    );

    // Now swap out any existing select
    const expression = Walker.mapSource(joinExpression, (exp) => {
        if (exp instanceof SelectExpression === false) {
            return exp;
        }

        // We always want a select at the base
        const select = new SelectExpression(exp.entity, fieldSet);
        return select;
    });


    return expression;

    function processKey(expression: AstExpression<`ArrowFunctionExpression`>, ...sources: Expression[]): Field | Field[] {
        // TODO: These sources need to be the identifiers!
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

        return new Field(converted, name);
    }

    function createJoinClause(outer: Field | Field[], inner: Field | Field[]): BinaryExpression | LogicalExpression {
        if (Array.isArray(outer) && Array.isArray(inner)) {
            return buildJoinClauses(outer, inner);
        } else if (Array.isArray(outer) === false && Array.isArray(inner) === false) {
            return new BinaryExpression(
                outer.source,
                `==`,
                inner.source,
            );
        } else {
            throw new Error(`The inner and outer keys returned incompatible result types`);
        }
    }

    function buildJoinClauses(outer: Field[], inner: Field[]): BinaryExpression | LogicalExpression {
        if (outer.length !== inner.length) {
            throw new Error(`The inner and outer keys returned different number of columns to match on`);
        }

        let current: BinaryExpression | LogicalExpression | undefined = undefined;
        for (const outerColumm of outer) {
            const innerColumn = inner.find(
                (column) => column.name === outerColumm.name
            );

            if (innerColumn === undefined) {
                throw new Error(`Unable to find field on the inner source named "${outerColumm.name.name}"`);
            }

            const clause = new BinaryExpression(
                outerColumm.source,
                `==`,
                innerColumn.source,
            );

            if (current === undefined) {
                current = clause;
            } else {
                current = new LogicalExpression(clause, `&&`, current);
            }
        }
        return current!;
    }
}
