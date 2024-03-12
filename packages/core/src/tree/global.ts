import { Expression } from './expression';
import { Type } from './type';

export class GlobalExpression extends Expression<`GlobalExpression`> {
    expressionType = `GlobalExpression` as const;
    // TODO: Does type make sense here?
    //  Maybe we need an unknown type?
    //  Or an identifier type?
    type: Type;
    name: string;

    constructor(name: string, type: Type) {
        super();
        this.name = name;
        this.type = type;
    }
}
