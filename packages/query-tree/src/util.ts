import { EntityIdentifier } from './index.js';
import { Source, EntitySource, SelectExpression, Boundary } from './source/index.js';
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
            if (exp.entity instanceof Boundary) {
                // TODO: What would this mean?
                throw new Error(`Received an Unexpected Boundary`);
            }

            return new SelectExpression(
                new Boundary<EntityIdentifier>(exp.entity, boundaryId),
                exp.fieldSet.boundary(boundaryId)
            );
        }

        if (exp instanceof EntitySource) {
            if (exp.entity instanceof Boundary) {
                // TODO: What would this mean?
                throw new Error(`Received an Unexpected Boundary`);
            }

            return new EntitySource(
                new Boundary<EntityIdentifier>(exp.entity, boundaryId),
                exp.fieldSet.boundary(boundaryId),
            );
        }

        return exp;
    }) as TSource;
}