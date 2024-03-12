import { Globals } from './convert/global';
import { Queryable } from './queryable/queryable';

export abstract class QueryProvider {
    abstract execute<TResult>(source: Queryable<TResult>): AsyncGenerator<TResult>;
    abstract globals: Globals;
}
