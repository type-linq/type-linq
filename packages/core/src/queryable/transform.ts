import { TransformExpression } from '@type-linq/query-tree';
import { Queryable } from './queryable.js';

export function defaultIfEmpty<TElement>(
    source: Queryable<TElement>,
    defaultValue: TElement,
) {
    return new TransformExpression(source.expression, undefined, (results: unknown[]) => {
        if (results.length === 0) {
            return [defaultValue];
        }
        return results;
    });
}

export function prepend<TElement>(
    source: Queryable<TElement>,
    elements: TElement[],
) {
    return new TransformExpression(source.expression, undefined, (results: unknown[]) => {
        return [...elements, ...results];
    });
}

export function append<TElement>(
    source: Queryable<TElement>,
    elements: TElement[],
) {
    return new TransformExpression(source.expression, undefined, (results: unknown[]) => {
        return [...results, ...elements];
    });
}
