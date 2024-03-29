import { Expression } from './expression.js';
import { BooleanType, Type } from './type.js';

export type UnaryOperator = `!`;

export class UnaryExpression extends Expression {
    type: Type;
    operator: UnaryOperator;
    expression: Expression;

    constructor(operator: UnaryOperator, expression: Expression) {
        super();
        this.operator = operator;
        this.expression = expression;
        this.type = new BooleanType();
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof UnaryExpression === false) {
            return false;
        }

        if (this.operator !== expression.operator) {
            return false;
        }

        return this.expression.isEqual(expression);
    }

    rebuild(expression: Expression | undefined): UnaryExpression {
        return new UnaryExpression(this.operator, expression ?? this.expression);
    }

    *walk() {
        yield this.expression;
    }
}
