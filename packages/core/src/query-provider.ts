import {
    EntitySource,
    Expression,
    FieldSet,
    JoinExpression,
    LogicalExpression,
    WhereClause,
    SelectExpression,
    Source,
    Walker,
    WhereExpression,
    Field,
    FieldIdentifier,
    Entity,
    LinkedEntity,
    OrderExpression,
} from '@type-linq/query-tree';
import { Globals } from './convert/global.js';
import { Queryable } from './queryable/queryable.js';

export abstract class QueryProvider {
    abstract execute<TResult>(source: Queryable<TResult>): AsyncGenerator<TResult>;
    abstract globals: Globals;

    finalize(source: Source, forceScalars = false): Source {
        if (source instanceof Entity) {
            // If we only have an entity, just handle scalars
            if (forceScalars) {
                return new SelectExpression(
                    source.fieldSet.scalars()
                );
            } else {
                return source;
            }
        }

        const whereClauses: WhereClause[] = [];

        const expression = Walker.mapSource(source, (exp) => {
            // TODO: Note: When we have group by we will need to collect separately
            //  on each side of the group by clause (So things like HAVING can be generated)
            if (exp instanceof WhereExpression) {
                whereClauses.push(exp.clause);
            }

            const sources: EntitySource[] = [];
            const search = (exp: Expression) => Walker.walk(exp, (exp) => {
                if (exp instanceof LinkedEntity) {
                    sources.push(exp);
                }
                if (exp instanceof FieldIdentifier) {
                    sources.push(exp.entity);
                }
            });

            switch (true) {
                case exp instanceof Entity:
                case exp instanceof SelectExpression:
                    search(exp.fieldSet);
                    break;
                case exp instanceof JoinExpression:
                    search(exp.condition);
                    break;
                case exp instanceof WhereExpression:
                    search(exp.clause);
                    break;
                case exp instanceof OrderExpression:
                    search(exp.expression);
                    break;
                default:
                    throw new Error(`Unexpected expression type "${exp.constructor.name}" received`);
            }

            let current = source instanceof WhereExpression ?
                source.source :
                source;

            for (const source of sources.filter(unique)) {
                current = source.applyLinked(current);
            }

            return current;
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
            new WhereExpression(expression, whereClause) :
            expression;

        if (forceScalars === false) {
            return result;
        }

        // There are 2 distinct cases we need to handle...
        //  1. We have selected an entity source directly, in which case we should generate a select
        //     expression using only it's scalars....
        //  2. We have an EntityType in one of the columns, in which case we must get all scalar fields
        //     and merge them into the existing fields (with "<Name>"."<Scalar Name>")

        const processExplodedField = (parent: string, field: Field) => {
            return new Field(
                field.expression,
                `${parent}.${field.name.name}`,
            );
        }

        const explodeEntity = (field: Field) => {
            if (field.expression instanceof EntitySource === false) {
                return field;
            }

            return field.expression.fieldSet.scalars().fields.map(
                (scalarField) => processExplodedField(field.name.name, scalarField)
            );
        }

        const fields = expression.fieldSet.fields.map(explodeEntity).flat();

        // Now swap out the base of the branch
        const finalResult = Walker.mapSource(expression, (exp) => {
            if (exp instanceof SelectExpression === false) {
                return exp;
            }

            const result = new SelectExpression(
                exp.fieldSet.scalar && fields.length === 1 ?
                    new FieldSet(fields[0]) :
                    new FieldSet(fields),
            );
            return result;
        });

        return finalResult;
    }
}

function unique(item: EntitySource, index: number, arr: EntitySource[]) {
    return arr.findIndex(
        (value) => item.isEqual(value)
    ) === index;
}
