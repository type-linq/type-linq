import { QueryProvider } from '../query-provider';
import { Expression, ExpressionType } from '../tree/expression';
import { select } from './select';
import { where } from './where';
import { Map, Predicate, Serializable } from '../type';

export class Queryable<TElement> {
    readonly provider: QueryProvider;
    readonly expression: Expression<ExpressionType>;

    constructor(provider: QueryProvider, expression: Expression<ExpressionType>) {
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
}
