/* eslint-disable @typescript-eslint/no-explicit-any */
import { Source } from '@type-linq/query-tree';
import { QueryProvider } from '../query-provider.js';
import { select } from './select.js';
import { where } from './where.js';
import { join } from './join.js';
import { Func, Serializable } from '../type.js';
import { SchemaType, StandardType } from '../schema-type.js';
import { orderBy, orderByDescending, thenBy, thenByDescending } from './order.js';
import { distinct } from './distinct.js';
import { groupBy } from './group.js';
import { first, firstOrDefault, single, singleOrDefault, skip, take } from './range.js';
import { append, defaultIfEmpty, prepend } from './transform.js';

export type GroupResult<TElement, TMapped, TResult> =
    TResult extends undefined
    ? TMapped extends undefined
    ? Queryable<TElement>
    : Queryable<TMapped>
    : Queryable<TResult>;

export class Queryable<TElement> {
    readonly provider: QueryProvider;
    readonly expression: Source;

    constructor(provider: QueryProvider, expression: Source) {
        this.provider = provider;
        this.expression = expression;
    }

    [Symbol.asyncIterator](): AsyncGenerator<TElement> {
        return this.provider.execute(this);
    }

    select<TMapped>(map: Func<TMapped, [SchemaType<TElement>]>, args?: Serializable) {
        return select(this, map, args);
    }

    where<TArgs extends Serializable | undefined = undefined>(predicate: Func<boolean, [SchemaType<TElement>, TArgs]>, args?: TArgs) {
        return where(this, predicate, args);
    }

    join<TInner, TKey, TResult, TArgs extends Serializable | undefined = undefined>(
        inner: Queryable<TInner>,
        outerKey: Func<TKey, [SchemaType<TElement>]>,
        innerKey: Func<TKey, [SchemaType<TInner>]>,
        result: Func<TResult, [SchemaType<TElement>, SchemaType<TInner>]>,
        args?: TArgs,
    ) {
        const expression = join(
            this as any,
            inner as any,
            outerKey,
            innerKey,
            result,
            args,
        );

        return new Queryable<StandardType<TResult>>(this.provider, expression);
    }

    orderBy<TKey>(
        key: Func<TKey, [TElement]>,
        args?: Serializable,
    ) {
        const expression = orderBy(
            this,
            key,
            args
        );

        return new Queryable<TElement>(
            this.provider,
            expression,
        );        
    }

    orderByDescending<TKey>(
        key: Func<TKey, [TElement]>,
        args?: Serializable,
    ) {
        const expression = orderByDescending(
            this,
            key,
            args
        );

        return new Queryable<TElement>(
            this.provider,
            expression,
        );        
    }

    thenBy<TKey>(
        key: Func<TKey, [TElement]>,
        args?: Serializable,
    ) {
        const expression = thenBy(
            this,
            key,
            args
        );

        return new Queryable<TElement>(
            this.provider,
            expression,
        );        
    }

    thenByDescending<TKey>(
        key: Func<TKey, [TElement]>,
        args?: Serializable,
    ) {
        const expression = thenByDescending(
            this,
            key,
            args
        );

        return new Queryable<TElement>(
            this.provider,
            expression,
        );
    }

    distinct() {
        const expression = distinct(this);
        return new Queryable<TElement>(
            this.provider,
            expression,
        );
    }

    groupBy<
        TKey,
        TMapped = undefined,
        TResult = undefined,
    >(
        key: Func<TKey, [TElement]>,
        element?: Func<TMapped, [TElement]>,
        result?: Func<TResult, [TKey, TMapped extends undefined ? TElement : TMapped]>,
        args?: Serializable,
    ): GroupResult<TElement, TMapped, TResult>  {

        const expression = groupBy(
            this,
            key,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            element as any,
            result,
            args,
        );

        return new Queryable(this.provider, expression) as GroupResult<TElement, TMapped, TResult>;
    }

    skip(count: number) {
        const expression = skip(this, count);
        return new Queryable<TElement>(this.provider, expression);
    }

    take(count: number) {
        const expression = take(this, count);
        return new Queryable<TElement>(this.provider, expression);
    }

    first() {
        return first(this);
    }

    firstOrDefault(defaultValue: TElement) {
        return firstOrDefault(this, defaultValue);
    }

    single() {
        return single(this);
    }

    singleOrDefault(defaultValue: TElement) {
        return singleOrDefault(this, defaultValue);
    }

    defaultIfEmpty(defaultValue: TElement) {
        const expression = defaultIfEmpty(this, defaultValue);
        return new Queryable<TElement>(this.provider, expression);
    }

    prepend(elements: TElement[]) {
        const expression = prepend(this, elements);
        return new Queryable<TElement>(this.provider, expression);
    }

    append(elements: TElement[]) {
        const expression = append(this, elements);
        return new Queryable<TElement>(this.provider, expression);
    }
}
