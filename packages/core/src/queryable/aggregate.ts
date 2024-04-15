import { SchemaType } from '../schema-type.js';
import { Func } from '../type.js';
import { Queryable } from './queryable.js';

export function sum<TElement>(
    source: Queryable<TElement>,
    key: Func<number, [SchemaType<TElement>]>
) {

    // TODO: How can we match this with a global identifier?
    //  Should it be matched with Math.sum? I think so....
    //  So... we will need to map the source expression as the arg to a global accessor mapping

    // TODO......
    throw new Error(`not implemented`);

}
