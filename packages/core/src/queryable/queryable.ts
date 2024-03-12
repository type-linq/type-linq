import { QueryProvider } from '../query-provider';
import { Expression } from '../tree/expression';
import { select } from './select';
import { where } from './where';
import { Map, Predicate } from '../type';

export class Queryable<TElement> {
    readonly provider: QueryProvider;
    readonly expression: Expression<string>;

    constructor(provider: QueryProvider, expression: Expression<string>) {
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

    where<TArgs = undefined>(predicate: Predicate<TElement, TArgs>, args?: TArgs) {
        const whr = where<TElement, TArgs>;
        return whr.call(this, predicate, args);
    }
}
