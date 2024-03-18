import { SourceExpression } from '@type-linq/query-tree';
import { QueryProvider } from '../query-provider.js';
import { select } from './select.js';
import { where } from './where.js';
import { join } from './join.js';
import { Map, Merge, Predicate, Serializable } from '../type.js';

export class Queryable<TElement> {
    readonly provider: QueryProvider;
    readonly expression: SourceExpression;

    constructor(provider: QueryProvider, expression: SourceExpression) {
        this.provider = provider;
        this.expression = expression;
    }

    [Symbol.asyncIterator](): AsyncGenerator<TElement> {
        return this.provider.execute(this);
    }

    select<TMapped, TArgs = undefined>(map: Map<TElement, TMapped>, args?: TArgs) {
        const sel = select<TElement, TMapped, TArgs>;
        return sel.call(this, map, args);
    }

    where<TArgs extends Serializable | undefined = undefined>(predicate: Predicate<TElement, TArgs>, args?: TArgs) {
        const whr = where<TElement, TArgs>;
        return whr.call(this, predicate, args);
    }

    join<TInner, TKey, TResult, TArgs extends Serializable | undefined = undefined>(
        inner: Queryable<TInner>,
        outerKey: Map<TElement, TKey>,
        innerKey: Map<TInner, TKey>,
        result: Merge<TElement, TInner, TResult>,
        args?: TArgs,
    ) {
        const jn = join<TElement, TInner, TKey, TResult, TArgs>;
        return jn.call(this, inner, outerKey, innerKey, result, args);
    }
}
