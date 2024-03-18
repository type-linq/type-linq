import { Expression } from './expression.js';
import { BooleanType, NumberType, Type } from './type.js';

export type EqualityOperator = `==` | `!=`;
export type ComparisonOperator = `<` | `>` | `<=` | `>=`;
export type MathOperator = `+` | `-` | `*` | `/` | `%`;

export type LogicalOperator = `||` | `&&` | `??`;
export type BinaryOperator = EqualityOperator | ComparisonOperator | MathOperator | LogicalOperator;

export abstract class BinaryExpressionBase<
    TExpression extends string,
    TOperator extends BinaryOperator,
> extends Expression<TExpression> {
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
}

export class BinaryExpression extends BinaryExpressionBase<`BinaryExpression`, BinaryOperator> {
    expressionType = 'BinaryExpression' as const;
}

export class LogicalExpression extends BinaryExpressionBase<`LogicalExpression`, LogicalOperator> {
    expressionType = 'LogicalExpression' as const;
}
