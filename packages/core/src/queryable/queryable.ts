import { Source } from '@type-linq/query-tree';
import { QueryProvider } from '../query-provider.js';
import { select } from './select.js';
import { where } from './where.js';
import { join } from './join.js';
import { Map, Merge, Predicate, Serializable } from '../type.js';

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

    select<TMapped>(map: Map<TElement, TMapped>, args?: Serializable) {
        return select(this, map, args);
    }

    where<TArgs extends Serializable | undefined = undefined>(predicate: Predicate<TElement, TArgs>, args?: TArgs) {
        return where(this, predicate, args);
    }

    join<TInner, TKey, TResult, TArgs extends Serializable | undefined = undefined>(
        inner: Queryable<TInner>,
        outerKey: Map<TElement, TKey>,
        innerKey: Map<TInner, TKey>,
        result: Merge<TElement, TInner, TResult>,
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

        return new Queryable<TResult>(this.provider, expression);
    }
}
