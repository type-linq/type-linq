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
    WhereClause,
    SubSource,
    FieldIdentifier,
    Boundary,
    Entity,
    FieldSet,
} from '@type-linq/query-tree';

import { convert } from '../convert/convert.js';
import { randString, readName } from '../convert/util.js';
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

export function join<TOuter, TInner, TKey, TResult>(
    outer: Queryable<TOuter>,
    inner: Queryable<TInner>,
    outerKey: ValueMap<TOuter, TKey>,
    innerKey: ValueMap<TInner, TKey>,
    result: Merge<TOuter, TInner, TResult>,
    args?: Serializable,
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
    const joinExpression = ingest(innerExpression);

    const fieldSet = transformSelect(
        [outerExpression, joinExpression.joined],
        resultAst,
        outer.provider.globals,
        args,
    );

    // Now swap out any existing select
    const expression = Walker.mapSource(joinExpression, (exp) => {
        if (exp instanceof SelectExpression === false) {
            return exp;
        }

        // We always want a select at the base
        const select = new SelectExpression(fieldSet);
        return select;
    });

    return expression;

    function ingest(expression: Source) {
        const boundaryId = randString();
        if (canIngest(expression) === false) {
            const subSource = new SubSource(expression);
            const innerKey = processKey(innerAst, expression);

            const convertField = (field: Field) => new Field(
                new FieldIdentifier(
                    subSource,
                    field.name.name,
                    field.type,
                ),
                field.name.name,
            );

            const innerColumns = Array.isArray(innerKey) ?
                innerKey.map(convertField) :
                convertField(innerKey);

            const condition = createJoinClause(outerColumns, innerColumns, boundaryId);
            return new JoinExpression(
                outerExpression,
                new Boundary(subSource, boundaryId),
                condition,
            )
        }

        const boundedFields = Walker.map(expression.fieldSet, (exp) => {
            if (exp instanceof FieldIdentifier === false) {
                return exp;
            }

            return new FieldIdentifier(
                new Boundary(
                    exp.entity,
                    boundaryId
                ),
                exp.name,
                exp.type,
            );
        }) as FieldSet;

        const bounded = Walker.mapSource(expression, (exp) => {
            if (exp instanceof SelectExpression === false && exp instanceof Entity === false) {
                return exp;
            }
            return new SelectExpression(boundedFields);
        });

        const innerColumns = processKey(innerAst, bounded);
        const condition = createJoinClause(outerColumns, innerColumns, boundaryId);

        // When we can ingest it means all we will have left is an EntitySource
        const innerSource = bounded as EntitySource;
        const joinExpression = new JoinExpression(
            outerExpression,
            new Boundary(innerSource, boundaryId),
            condition,
        );
        return joinExpression;
    }

    function processKey(expression: AstExpression<`ArrowFunctionExpression`>, ...sources: Expression[]): Field | Field[] {
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
                return processKeyValue(expression.body, name, vars, sourceMap);
            }
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

    function createJoinClause(outer: Field | Field[], inner: Field | Field[], boundaryId: string): WhereClause {
        if (Array.isArray(outer) && Array.isArray(inner)) {
            return buildJoinClauses(outer, inner, boundaryId);
        } else if (Array.isArray(outer) === false && Array.isArray(inner) === false) {
            return new BinaryExpression(
                outer.expression,
                `==`,
                inner.expression,
            );
        } else {
            throw new Error(`The inner and outer keys returned incompatible result types`);
        }
    }

    function buildJoinClauses(outer: Field[], inner: Field[], boundaryId: string): WhereClause {
        if (outer.length !== inner.length) {
            throw new Error(`The inner and outer keys returned different number of columns to match on`);
        }

        let current: WhereClause | undefined = undefined;
        for (const outerColumm of outer) {
            const innerColumn = inner.find(
                (column) => column.name === outerColumm.name
            );

            if (innerColumn === undefined) {
                throw new Error(`Unable to find field on the inner source named "${outerColumm.name.name}"`);
            }

            const clause = new BinaryExpression(
                outerColumm.expression,
                `==`,
                innerColumn.boundary(boundaryId).expression,
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

function canIngest(expression: Source) {
    // TODO: Allow select expression whose fields are
    //  all directly pointed at the same entity (i.e.
    // only references to values, no expressions)

    // TODO: Add code once we have aggregation functions
    return expression instanceof EntitySource;
}