import { SkipExpression, Source, TakeExpression } from '@type-linq/query-tree';

export function skip(
    source: Source,
    count: number,
): Source {
    const expression = new SkipExpression(source, count);
    return expression;
}

export function take(
    source: Source,
    count: number,
): Source {
    const expression = new TakeExpression(source, count);
    return expression;
}

export function first(source: Source) {
    const limited = take(source, 1);
    return limited;
}

export function firstOrDefault(source: Source) {
    const limited = take(source, 1);
    return limited;
}

export function single(source: Source) {
    const limited = take(source, 2);
    return limited;
}

export function singleOrDefault(source: Source) {
    const limited = take(source, 1);
    return limited;
}
