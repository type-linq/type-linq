import { BinaryExpression, EntitySource, Expression, FieldSet, JoinExpression, LinkedEntitySource, LogicalExpression, SelectExpression, Source, SubSource, Walker, WhereExpression } from '@type-linq/query-tree';
import { Globals } from './convert/global.js';
import { Queryable } from './queryable/queryable.js';

export abstract class QueryProvider {
    abstract execute<TResult>(source: Queryable<TResult>): AsyncGenerator<TResult>;
    abstract globals: Globals;

    finalize(source: Source, forceScalars = false): Source {
        const whereClauses: (LogicalExpression | BinaryExpression)[] = [];

        const expression = Walker.mapSource(source, (exp) => {
            if (exp instanceof WhereExpression) {
                whereClauses.push(exp.clause);
                return exp.source;
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

            // TODO: We only want link sources from the fields... we need to
            //  stop collecting at any EntitySource!
            // TODO: We need to remove the linked sources! Or just ignore them later?

            // TODO: Looks like we need a special field walker....
            // Basically something that won't walk fieldSet (unless it's the root)

            const linkedSources = Walker.collect(
                expression,
                (exp, ctx) => {
                    if (exp instanceof LinkedEntitySource) {
                        console.log(ctx);
                    }
                    return exp instanceof LinkedEntitySource;
                },
                undefined,
                (exp, ctx) => ctx.depth === 0 ?
                    false :
                    exp instanceof FieldSet
            ).filter(
                (ele, idx, arr) => arr.findIndex((item) => item.isEqual(ele)) === idx
            ) as LinkedEntitySource[];

            if (linkedSources.length === 0) {
                return exp;
            }

            let current: Source = exp;
            for (const source of linkedSources) {
                current = processLinked.call(this, source);
            }

            return current;

            function processLinked(this: QueryProvider, linked: LinkedEntitySource) {
                if (linked.linked instanceof EntitySource === false) {
                    processLinked.call(this, linked.linked);
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
