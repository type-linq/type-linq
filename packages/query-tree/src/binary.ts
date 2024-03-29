import { Expression } from './expression.js';
import { BooleanType, NumberType, Type } from './type.js';

export type EqualityOperator = `==` | `!=`;
export type ComparisonOperator = `<` | `>` | `<=` | `>=`;
export type MathOperator = `+` | `-` | `*` | `/` | `%`;

export type LogicalOperator = `||` | `&&` | `??`;
export type BinaryOperator = EqualityOperator | ComparisonOperator | MathOperator | LogicalOperator;

export abstract class BinaryExpressionBase<TOperator extends BinaryOperator> extends Expression {
    left: Expression;
    operator: TOperator;
    right: Expression;
    type: Type;

    constructor(left: Expression, operator: TOperator, right: Expression) {
        super();
        this.left = left;
        this.operator = operator;
        this.right = right;

        switch (operator) {
            case `==`:
            case `!=`:
            case `<`:
            case `>`:
            case `<=`:
            case `>=`:
                this.type = new BooleanType();
                break;
            case `+`:
                if (this.left.type.name !== this.right.type.name) {
                    throw new Error(
                        `Binary operator "${operator}" can only be applied to items ` +
                            `of the same place`
                    );
                }
                this.type = this.left.type;
                break;
            case `-`:
            case `*`:
            case `/`:
                this.type = new NumberType();
                break;
            case `||`:
            case `&&`:
                this.type = new BooleanType();
                break;
            default:
                throw new Error(`Unrecognized operator "${operator}" received`);
        }
    }

    isEqual(expression?: Expression): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof BinaryExpressionBase === false) {
            return false;
        }
        if (Object.getPrototypeOf(this) !== Object.getPrototypeOf(expression)) {
            return false;
        }

        return this.operator === expression.operator &&
            this.left.isEqual(expression.left) &&
            this.right.isEqual(expression.right);
    }

    *walk() {
        yield this.left;
        yield this.right;
    }
}

export class BinaryExpression extends BinaryExpressionBase<BinaryOperator> {
    rebuild(left: Expression | undefined, right: Expression | undefined): Expression {
        return new BinaryExpression(
            left ?? this.left,
            this.operator,
            right ?? this.right,
        );
    }
}

export class LogicalExpression extends BinaryExpressionBase<LogicalOperator> {
    rebuild(left: Expression | undefined, right: Expression | undefined): Expression {
        return new LogicalExpression(
            left ?? this.left,
            this.operator,
            right ?? this.right,
        );
    }
}
