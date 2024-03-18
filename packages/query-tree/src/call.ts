import { Expression } from './expression.js';
import { Type } from './type.js';

export class CallExpression extends Expression<`CallExpression`> {
    expressionType = `CallExpression` as const;
    callee: Expression;
    arguments: Expression[];
    type: Type;
    

    constructor(type: Type, callee: Expression, args: Expression[] = []) {
        super();
        this.type = type;
        this.callee = callee;
        this.arguments = args;
    }
}
