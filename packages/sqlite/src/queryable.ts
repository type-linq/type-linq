import { Queryable } from '../../core/src/queryable';
import { Expression, ExpressionType } from '../../core/src/type';
import { SqliteProvider } from './provider';

export class SqliteQueryableSource<TElement> extends Queryable<TElement> {
    constructor(provider: SqliteProvider, identifier: string) {
        const expression = {
            type: ExpressionType.Identifier,
            name: identifier,
        } as Expression<ExpressionType.Identifier>;

        super(provider, expression);
    }
}
