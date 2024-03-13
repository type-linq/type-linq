import { Queryable } from '../../core/src/queryable/queryable';
import { SourceExpression } from '../../core/src/tree/source';
import { SqliteProvider } from './provider';

export class SqliteQueryableSource<TElement> extends Queryable<TElement> {
    constructor(provider: SqliteProvider, source: SourceExpression) {
        super(provider, source);
    }
}
