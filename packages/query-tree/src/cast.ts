import { Expression } from './expression.js';
import { Type, isEqual } from './type.js';

export class CastExpression extends Expression {
    readonly expression: Expression;
    readonly type: Type;

    constructor(expression: Expression, type: Type) {
        super();
        this.expression = expression;
        this.type = type;
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof CastExpression === false) {
            return false;
        }

        return this.expression.isEqual(expression.expression) &&
            isEqual(expression.type, this.type);
    }

    protected rebuild(expression: Expression): Expression {
        return new CastExpression(expression, this.type);
    }

    *walk() {
        yield this.expression;
    }
}
