import { Expression } from './expression';
import { BooleanType, Type } from './type';

export type UnaryOperator = `!`;

export class UnaryExpression extends Expression<`UnaryExpression`> {
    expressionType = `UnaryExpression` as const;
    type: Type;
    operator: UnaryOperator;
    expression: Expression<string>;

    constructor(operator: UnaryOperator, expression: Expression<string>) {
        super();
        this.operator = operator;
        this.expression = expression;
        this.type = new BooleanType();
    }
}
