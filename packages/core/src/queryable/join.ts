import {
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

import { randString } from '../convert/util.js';
import { Expression as AstExpression, Serializable } from '../type.js';
import { transformSelect } from './select.js';
import { processKey } from './util.js';
import { QueryProvider } from '../query-provider.js';

// TODO: Add override that will take inner and 2 functions...
//  1. A function that will return a logical expression used to join
//  2. A result selector

export function join(
    provider: QueryProvider,
    outerExpression: Source,
    innerExpression: Source,
    outerAst: AstExpression<`ArrowFunctionExpression`>,
    innerAst: AstExpression<`ArrowFunctionExpression`>,
    resultAst: AstExpression<`ArrowFunctionExpression`>,
    args?: Serializable,
): Source {
    const outerColumns = processKey(args, provider, outerAst, outerExpression);
    const joinExpression = ingest(innerExpression);

    const fieldSet = transformSelect(
        [outerExpression, joinExpression.joined],
        resultAst,
        provider,
        args,
    );

    // Now swap out any existing select
    const expression = Walker.mapSource(joinExpression, (exp) => {
        if (exp instanceof SelectExpression === false) {
            return exp;
        }

        // We always want a select at the base
        const select = new SelectExpression(fieldSet, exp.distinct);
        return select;
    });

    return expression;

    function ingest(expression: Source) {
        const boundaryId = randString();
        if (canIngest(expression) === false) {
            const subSource = new SubSource(expression);
            const innerKey = processKey(args, provider, innerAst, expression);

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
            return new SelectExpression(boundedFields, exp instanceof SelectExpression ? exp.distinct : false);
        });

        const innerColumns = processKey(args, provider, innerAst, bounded);
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