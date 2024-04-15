import { Source, TransformExpression } from '@type-linq/query-tree';

export function defaultIfEmpty<TElement>(
    source: Source,
    defaultValue: TElement,
) {
    return new TransformExpression(source, undefined, (results: unknown[]) => {
        if (results.length === 0) {
            return [defaultValue];
        }
        return results;
    });
}

export function prepend<TElement>(
    source: Source,
    elements: TElement[],
) {
    return new TransformExpression(source, undefined, (results: unknown[]) => {
        return [...elements, ...results];
    });
}

export function append<TElement>(
    source: Source,
    elements: TElement[],
) {
    return new TransformExpression(source, undefined, (results: unknown[]) => {
        return [...results, ...elements];
    });
}
