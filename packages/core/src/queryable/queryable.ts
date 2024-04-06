import { Source } from '@type-linq/query-tree';
import { QueryProvider } from '../query-provider.js';
import { select } from './select.js';
import { where } from './where.js';
import { join } from './join.js';
import { Map, Merge, Predicate, Serializable } from '../type.js';
import { SchemaType, StandardType } from '../schema-type.js';
import { orderBy, orderByDescending, thenBy, thenByDescending } from './order.js';

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

    select<TMapped>(map: Map<SchemaType<TElement>, TMapped>, args?: Serializable) {
        return select(this, map, args);
    }

    where<TArgs extends Serializable | undefined = undefined>(predicate: Predicate<SchemaType<TElement>, TArgs>, args?: TArgs) {
        return where(this, predicate, args);
    }

    join<TInner, TKey, TResult, TArgs extends Serializable | undefined = undefined>(
        inner: Queryable<TInner>,
        outerKey: Map<SchemaType<TElement>, TKey>,
        innerKey: Map<SchemaType<TInner>, TKey>,
        result: Merge<SchemaType<TElement>, SchemaType<TInner>, TResult>,
        args?: TArgs,
    ) {
        const expression = join(
            this,
            inner,
            outerKey,
            innerKey,
            result,
            args,
        );

        return new Queryable<StandardType<TResult>>(this.provider, expression);
    }

    orderBy<TKey>(
        key: Map<TElement, TKey>,
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
        key: Map<TElement, TKey>,
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
        key: Map<TElement, TKey>,
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
        key: Map<TElement, TKey>,
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
}
