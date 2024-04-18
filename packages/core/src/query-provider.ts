import {
    EntitySource,
    Expression,
    JoinExpression,
    SelectExpression,
    Source,
    Walker,
    WhereExpression,
    FieldIdentifier,
    Entity,
    LinkedEntity,
    OrderExpression,
    GroupExpression,
    TakeExpression,
    SkipExpression,
    TransformExpression,
    SubSource,
} from '@type-linq/query-tree';
import { Globals } from './convert/global.js';
import { Queryable } from './queryable/queryable.js';

export abstract class QueryProvider {
    abstract execute<TResult>(source: Queryable<TResult>): AsyncGenerator<TResult>;
    abstract globals: Globals;

    finalize(source: Source): Source {
        // TODO: Limit the fields of sub sources to only those used

        if (source instanceof Entity) {
            // If we only have an entity, just return the scalars
            return new SelectExpression(
                source.fieldSet.scalars()
            );
        }

        const subSources: SubSource[] = [];
        const sourceDeduped = Walker.map(source, (exp) => {
            switch (true) {
                case exp instanceof FieldIdentifier:
                    if (exp.entity instanceof SubSource) {
                        return new FieldIdentifier(
                            subSource(exp.entity),
                            exp.name,
                            exp.type,
                        );
                    }
                    return exp;
                case exp instanceof SubSource:
                    return subSource(exp);
                default:
                    return exp;
            }

            function subSource(sub: SubSource) {
                for (const item of subSources) {
                    if (item.sub.isEqual(sub.sub)) {
                        return item;
                    }
                }
                subSources.push(sub);
                return sub;
            }
            
        }) as Source;

        const expression = Walker.mapSource(sourceDeduped, (exp) => {
            const sources: EntitySource[] = [];
            const searchForEntity = (exp: Expression) => Walker.walk(exp, (exp) => {
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
                    searchForEntity(exp.fieldSet);
                    break;
                case exp instanceof JoinExpression:
                    searchForEntity(exp.condition);
                    break;
                case exp instanceof WhereExpression:
                    searchForEntity(exp.clause);
                    exp = exp.collapse();
                    break;
                case exp instanceof OrderExpression:
                    searchForEntity(exp.expression);
                    break;
                case exp instanceof GroupExpression:
                    searchForEntity(exp.by);
                    break;
                case exp instanceof TakeExpression:
                case exp instanceof SkipExpression:
                case exp instanceof TransformExpression:
                    break;
                default:
                    throw new Error(`Unexpected expression type "${exp.constructor.name}" received`);
            }

            let current = exp;
            for (const source of sources.filter(unique)) {
                current = source.applyLinked(current);
            }
            return current;
        });

        return expression;
    }
}

function unique(item: EntitySource, index: number, arr: EntitySource[]) {
    return arr.findIndex(
        (value) => item.isEqual(value)
    ) === index;
}
