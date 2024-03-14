import {
    Queryable,
    SourceExpression,
} from '@type-linq/core';
import { SqliteProvider } from './provider';

export class SqliteQueryableSource<TElement> extends Queryable<TElement> {
    constructor(provider: SqliteProvider, source: SourceExpression) {
        super(provider, source);
    }
}
