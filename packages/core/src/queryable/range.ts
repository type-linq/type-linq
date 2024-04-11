import { SkipExpression, Source, TakeExpression } from '@type-linq/query-tree';
import { Queryable } from './queryable.js';

export function skip(
    source: Queryable<unknown>,
    count: number,
): Source {
    const expression = new SkipExpression(source.expression, count);
    return expression;
}

export function take(
    source: Queryable<unknown>,
    count: number,
): Source {
    const expression = new TakeExpression(source.expression, count);
    return expression;
}

export async function first<TElement>(
    source: Queryable<TElement>
) {
    const limited = take(source, 1);
    const query = new Queryable<TElement>(source.provider, limited);
    for await (const result of query) {
        return result;
    }

    throw new Error(`Sequence contains no results`);
}

export async function firstOrDefault<TElement>(
    source: Queryable<TElement>,
    defaultValue: TElement,
) {
    const limited = take(source, 1);
    const query = new Queryable<TElement>(source.provider, limited);
    for await (const result of query) {
        return result;
    }

    return defaultValue;
}

export async function single<TElement>(
    source: Queryable<TElement>
) {
    const limited = take(source, 2);
    const query = new Queryable<TElement>(source.provider, limited);
    let result: TElement | undefined = undefined;
    for await (const item of query) {
        if (result !== undefined) {
            throw new Error(`Sequence contains multiple results`);
        }
        result = item;
    }

    if (result === undefined) {
        throw new Error(`Sequence contains no results`);
    }

    return result as TElement;
}

export async function singleOrDefault<TElement>(
    source: Queryable<TElement>,
    defaultValue: TElement,
) {
    const limited = take(source, 2);
    const query = new Queryable<TElement>(source.provider, limited);
    let result: TElement | undefined = undefined;
    for await (const item of query) {
        if (result !== undefined) {
            throw new Error(`Sequence contains multiple results`);
        }
        result = item;
    }

    if (result === undefined) {
        return defaultValue;
    }

    return result as TElement;
}
