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
    WhereExpression,
    EntityIdentifier,
    Field,
    OrderExpression,
    Boundary,
} from '@type-linq/query-tree';
import { Globals } from './convert/global.js';
import { Queryable } from './queryable/queryable.js';

export abstract class QueryProvider {
    abstract execute<TResult>(source: Queryable<TResult>): AsyncGenerator<TResult>;
    abstract globals: Globals;

    finalize(source: Source, forceScalars = false): Source {

        // TODO: Something is not right here...
        //  We end up with LinkedEntitySources in the tree...

        const whereClauses: WhereClause[] = [];

        const expression = Walker.mapSource(source, (exp) => {
            if (exp instanceof Source === false) {
                return exp;
            }

            // TODO: Note: When we have group by we will need to collect separately
            //  on each side of the group by clause (So things like HAVING can be generated)
            if (exp instanceof WhereExpression) {
                whereClauses.push(exp.clause);
            }

            const { linkedSources, expression } = extractLinkedSources(this, exp);

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
                if (linked.linked instanceof LinkedEntitySource) {
                    return processLinked(provider, linked.linked);
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

        const result = whereClause ?
            new WhereExpression(deduped, whereClause) :
            deduped;

        if (forceScalars === false) {
            return result;
        }

        // There are 2 distinct cases we need to handle...
        //  1. We have selected an entity source directly, in which case we should generate a select
        //     expression using only it's scalars....
        //  2. We have an EntityType in one of the columns, in which case we must get all scalar fields
        //     and merge them into the existing fields (with "<Name>"."<Scalar Name>")

        const withSelect = Walker.mapSource(result, (exp) => {
            if (exp instanceof EntitySource === false) {
                return exp;
            }

            // We always want a select at the base
            const result = new SelectExpression(
                exp.entity,
                source.fieldSet.scalars(),
            );
            return result;
        });

        const fields = withSelect.fieldSet.fields.map(
            (entityField) => entityField.source instanceof Source ?
                entityField.source.fieldSet.scalars().fields.map(
                    (field) => new Field(
                        field.source,
                        `${entityField.name.name}.${field.name.name}`,
                    )
                ) :
                entityField
        ).flat();

        // TODO: This doesn't work because the fields aren't bounded?
        //  why isn't the Supplier field bounded?

        // Now swap out the base of the branch
        const finalResult = Walker.mapSource(withSelect, (exp) => {
            if (exp instanceof SelectExpression === false) {
                return exp;
            }

            // We always want a select at the base
            const result = new SelectExpression(
                exp.entity,
                exp.fieldSet.scalar && fields.length === 1 ?
                    new FieldSet(fields[0]) :
                    new FieldSet(fields),
            );
            return result;
        });

        return finalResult;
    }
}

export function extractLinkedSources<TResult extends Source | Field>(
    provider: QueryProvider,
    exp: TResult
): { expression: TResult, linkedSources: LinkedEntitySource[] } {
    let searchExpression: Expression;
    let linked: Expression;
    switch (true) {
        case exp instanceof Field:
            searchExpression = exp.source;
            linked = exp;
            break;
        case exp instanceof JoinExpression:
            searchExpression = exp.condition;
            linked = exp.source;
            if (exp.source instanceof SubSource) {
                linked = new SubSource(
                    provider.finalize(exp.source.source, false),
                    exp.source.identifier,
                );
            }
            break;
        case exp instanceof WhereExpression:
            searchExpression = exp.clause;
            linked = exp.source;
            break;
        case exp instanceof OrderExpression:
            searchExpression = exp.expression;
            linked = exp.source;
            break;
        case exp instanceof EntitySource:
            searchExpression = exp.fieldSet.scalars();
            linked = exp.entity;
            break;
        case exp instanceof SelectExpression:
            searchExpression = exp.fieldSet;
            linked = exp.entity;
            break;
        default:
            throw new Error(`Unexpected expression type "${exp.constructor.name}" received`);
    }

    let linkedSources: LinkedEntitySource[] = [];

    // TODO: Does not appear to be cleaning order items?

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

    let result: Source | Field;
    switch (true) {
        case exp instanceof Field:
            result = new Field(
                cleaned,
                exp.name.name,
            );
            break;
        case exp instanceof JoinExpression:
            result = new JoinExpression(
                linked as Source,
                exp.joined,
                cleaned as WhereClause,
            );
            break;
        case exp instanceof WhereExpression:
            result = new WhereExpression(
                linked as Source,
                cleaned as WhereClause,
            );
            break;
        case exp instanceof OrderExpression:
            result = new OrderExpression(
                linked as Source,
                cleaned,
            );
            break;
        case exp instanceof EntitySource:
        case exp instanceof SelectExpression:
            result = new SelectExpression(
                linked as EntityIdentifier,
                cleaned as FieldSet,
            );
            break;
        default:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            throw new Error(`Unexpected source type "${(exp as any).constructor.name}"`);
    }

    return {
        expression: result as TResult,
        linkedSources,
    };
}