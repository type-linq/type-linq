import { Expression } from './expression';
import { Type } from './type';

export class CallExpression extends Expression<`CallExpression`> {
    expressionType = `CallExpression` as const;
    callee: Expression<string>;
    arguments: Expression<string>[];
    type: Type;
    

    constructor(type: Type, callee: Expression<string>, args: Expression<string>[] = []) {
        super();
        this.type = type;
        this.callee = callee;
        this.arguments = args;
    }
}
