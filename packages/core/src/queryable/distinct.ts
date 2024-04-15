import { Entity, SelectExpression, Source, Walker } from '@type-linq/query-tree';

export function distinct(source: Source): Source {
    return Walker.mapSource(source, (exp) => {
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