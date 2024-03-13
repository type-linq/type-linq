import { Expression, ExpressionType } from './expression';
import { Type } from './type';

export class CallExpression extends Expression<`CallExpression`> {
    expressionType = `CallExpression` as const;
    callee: Expression<ExpressionType>;
    arguments: Expression<ExpressionType>[];
    type: Type;
    

    constructor(type: Type, callee: Expression<ExpressionType>, args: Expression<ExpressionType>[] = []) {
        super();
        this.type = type;
        this.callee = callee;
        this.arguments = args;
    }
}
