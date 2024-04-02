import { Source, EntitySource, SelectExpression } from './source/index.js';
import { Walker } from './walk.js';

export function randString(length?: number) {
    const result = Math.random().toString(36).substring(2);
    if (length as number > 0) {
        return result.substring(0, length);
    }
    return result;
}

export function boundary<TSource extends Source>(source: TSource, boundaryId = randString()): TSource {
    return Walker.mapSource(source, (exp) => {
        if (exp instanceof SelectExpression) {
            return new SelectExpression(exp.entity, exp.fieldSet.boundary(boundaryId));
        }

        if (exp instanceof EntitySource) {
            return new EntitySource(
                exp.entity,
                exp.fieldSet.boundary(boundaryId),
            );
        }

        return exp;
    }) as TSource;
}