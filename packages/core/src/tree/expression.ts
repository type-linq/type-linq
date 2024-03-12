// TODO: Export all possible expression types...

import { Type } from './type';

export abstract class Expression<TType extends string> {
    abstract expressionType: TType;
    abstract type: Type;
}
