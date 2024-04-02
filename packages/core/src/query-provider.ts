import { BinaryExpression, EntitySource, Expression, FieldSet, JoinExpression, LinkedEntitySource, LogicalExpression, SelectExpression, Source, SubSource, Walker, WhereExpression } from '@type-linq/query-tree';
import { Globals } from './convert/global.js';
import { Queryable } from './queryable/queryable.js';

export abstract class QueryProvider {
    abstract execute<TResult>(source: Queryable<TResult>): AsyncGenerator<TResult>;
    abstract globals: Globals;

    finalize(source: Source, forceScalars = false): Source {
        // TODO: Add bounding when we join linked sources

        const whereClauses: (LogicalExpression | BinaryExpression)[] = [];

        const expression = Walker.mapSource(source, (exp) => {
            if (exp instanceof WhereExpression) {
                whereClauses.push(exp.clause);
            }

            let expression: Expression;
            switch (true) {
                case exp instanceof JoinExpression:
                    expression = exp.condition;
                    // TODO: We still need to process the condition!
                    // TODO: What if the condition has linked sources that belong to the sub source?
                    if (exp.source instanceof SubSource) {
                        throw new Error(`Not yet supported`);
                    }
                    break;
                case exp instanceof WhereExpression:
                    expression = exp.clause;
                    break;
                case exp instanceof SelectExpression:
                case exp instanceof EntitySource:
                    expression = exp.fieldSet;
                    break;
                default:
                    return exp;
            }

            // TODO: Want these joins to be first.....

            const linkedSources = Walker.collect(
                expression,
                (exp) => exp instanceof LinkedEntitySource,
                undefined,
                // We don't want to walk FieldSet's since that will be circular
                (exp, ctx) => ctx.depth === 0 ? false : exp instanceof FieldSet
            ).filter(
                // Make sure they are unique
                (ele, idx, arr) => arr.findIndex((item) => item.isEqual(ele)) === idx
            ) as LinkedEntitySource[];

            if (linkedSources.length === 0) {
                if (exp instanceof WhereExpression) {
                    return exp.source;
                }
                return exp;
            }

            let current: Source;
            if (exp instanceof JoinExpression) {
                current = exp.source;
            } else if (exp instanceof WhereExpression) {
                current = exp.source;
            } else {
                current = exp;
            }

            for (const source of linkedSources) {
                current = processLinked(this, source);
            }

            if (exp instanceof JoinExpression) {
                return new JoinExpression(
                    current,
                    exp.joined,
                    exp.condition,
                );
            } else {
                return current;
            }

            return current;

            function processLinked(provider: QueryProvider, linked: LinkedEntitySource) {
                if (linked.linked instanceof EntitySource === false) {
                    processLinked(provider, linked.linked);
                }

                // TODO: This doesn't work... we need the clause bound!
                // const 
                // TODO: Bound joined
                // linked.source

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

        const whereClause = whereClauses.reduce<LogicalExpression | BinaryExpression | undefined>(
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
