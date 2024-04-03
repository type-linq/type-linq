import {
    EntitySource,
    Expression,
    FieldSet,
    JoinExpression,
    LinkedEntitySource,
    LogicalExpression,
    WhereClause,
    SelectExpression,
    Source,
    SubSource,
    Walker,
    WhereExpression
} from '@type-linq/query-tree';
import { Globals } from './convert/global.js';
import { Queryable } from './queryable/queryable.js';

export abstract class QueryProvider {
    abstract execute<TResult>(source: Queryable<TResult>): AsyncGenerator<TResult>;
    abstract globals: Globals;

    finalize(source: Source, forceScalars = false): Source {
        // TODO: Add bounding when we join linked sources

        const whereClauses: WhereClause[] = [];

        const expression = Walker.mapSource(source, (exp) => {
            if (exp instanceof Source === false) {
                return exp;
            }

            if (exp instanceof WhereExpression) {
                whereClauses.push(exp.clause);
            }

            const { linkedSources, expression } = extractLinkedSources(exp);

            if (linkedSources.length === 0) {
                if (exp instanceof WhereExpression) {
                    return exp.source;
                }
                return exp;
            }

            let current: Source;
            switch (true) {
                case expression instanceof JoinExpression:
                case expression instanceof WhereExpression:
                    current = expression.source;
                    break;
                default:
                    current = expression;
                    break;
            }

            for (const source of linkedSources) {
                current = processLinked(this, source);
            }

            if (expression instanceof JoinExpression) {
                return new JoinExpression(
                    current,
                    expression.joined,
                    expression.condition,
                );
            } else {
                return current;
            }

            function processLinked(provider: QueryProvider, linked: LinkedEntitySource) {
                if (linked.linked instanceof EntitySource === false) {
                    processLinked(provider, linked.linked);
                }

                return new JoinExpression(
                    current,
                    linked.source.entity,
                    linked.clause,
                );
            }
        });

        const joins: JoinExpression[] = [];
        const deduped = Walker.mapSource(expression, (exp) => {
            if (exp instanceof JoinExpression === false) {
                return exp;
            }

            const existing = joins.find(
                (join) => join.joined.isEqual(exp.joined) &&
                    join.condition.isEqual(exp.condition)
            );

            if (existing) {
                return exp.source;
            }

            joins.push(exp);
            return exp;
        });

        // TODO: forceScalars!

        const whereClause = whereClauses.reduce<WhereClause | undefined>(
            (result, clause) => {
                if (result === undefined) {
                    return clause;
                } else {
                    return new LogicalExpression(result, `&&`, clause);
                }
            },
            undefined,
        );

        if (whereClause) {
            return new WhereExpression(deduped, whereClause);
        } else {
            return deduped;
        }
    }
}

function extractLinkedSources(exp: Source) {
    let searchExpression: Expression;
    switch (true) {
        case exp instanceof JoinExpression:
            searchExpression = exp.condition;
            // TODO: We still need to process the condition!
            // TODO: What if the condition has linked sources that belong to the sub source?
            if (exp.source instanceof SubSource) {
                throw new Error(`Not yet supported`);
            }
            break;
        case exp instanceof WhereExpression:
            searchExpression = exp.clause;
            break;
        case exp instanceof EntitySource:
            searchExpression = exp.fieldSet.scalars();
            break;
        case exp instanceof SelectExpression:
            searchExpression = exp.fieldSet;
            break;
        default:
            throw new Error(`Unexpected expression type "${exp.constructor.name}" received`);
    }

    let linkedSources: LinkedEntitySource[] = [];
    const cleaned = Walker.map(
        searchExpression,
        (exp) => {
            if (exp instanceof LinkedEntitySource === false) {
                return exp;
            }
            linkedSources.push(exp);
            return exp.source;
        },
        undefined,
        (exp, { depth }) => {
            return depth > 0 && exp instanceof FieldSet;
        }
    );

    linkedSources = linkedSources.filter(
        // Make sure they are unique
        (ele, idx, arr) => arr.findIndex(
            (item) => item.isEqual(ele)
        ) === idx
    );

    let result: Source;
    switch (true) {
        case exp instanceof JoinExpression:
            result = new JoinExpression(
                exp.source,
                exp.joined,
                cleaned as WhereClause,
            );
            break;
        case exp instanceof WhereExpression:
            result = new WhereExpression(
                exp.source,
                cleaned as WhereClause,
            );
            break;
        case exp instanceof EntitySource:
        case exp instanceof SelectExpression:
            result = new SelectExpression(
                exp.entity,
                cleaned as FieldSet,
            );
            break;
        default:
            return exp;
    }

    return {
        expression: result,
        linkedSources,
    };
}