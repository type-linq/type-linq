import { Expression, ExpressionType } from './expression';
import { BooleanType, Type } from './type';

export type UnaryOperator = `!`;

export class UnaryExpression extends Expression<`UnaryExpression`> {
    expressionType = `UnaryExpression` as const;
    type: Type;
    operator: UnaryOperator;
    expression: Expression<ExpressionType>;

    constructor(operator: UnaryOperator, expression: Expression<ExpressionType>) {
        super();
        this.operator = operator;
        this.expression = expression;
        this.type = new BooleanType();
    }
}
