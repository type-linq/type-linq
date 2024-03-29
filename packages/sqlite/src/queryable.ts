import { Queryable } from '@type-linq/core';
import { Source } from '@type-linq/query-tree'
import { SqliteProvider } from './provider.js';

export class SqliteQueryableSource<TElement> extends Queryable<TElement> {
    constructor(provider: SqliteProvider, source: Source) {
        super(provider, source);
    }
}
