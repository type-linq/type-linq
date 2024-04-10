import { Entity, SelectExpression, Source, Walker } from '@type-linq/query-tree';
import { Queryable } from './queryable.js';

export function distinct<TElement>(
    source: Queryable<TElement>
): Source {

    return Walker.mapSource(source.expression, (exp) => {
        switch (true) {
            case exp instanceof SelectExpression:
            case exp instanceof Entity:
                return new SelectExpression(
                    exp.fieldSet,
                    true,
                );
            default:
                return exp;
        }
    });
}