export type ExpressionType = `BinaryExpression` | `LogicalExpression` | `VariableExpression` |
    `CallExpression` | `CaseExpression` | `CaseBlock` | `Column` | `GlobalExpression` | `Identifier` |
    `JoinExpression` | `Literal` | `SelectExpression` | `SourceExpression` | `TernaryExpression` |
    `UnaryExpression`;

import { Type, areTypesEqual } from './type';

export abstract class Expression<TType extends string> {
    abstract expressionType: TType;
    abstract type: Type;
    
    isEqual(expression: Expression<TType>): boolean {
        if (areTypesEqual(this.type, expression.type) === false) {
            return false;
        }

        for (const [name, value] of Object.entries(expression)) {
            if (name === `type`) {
                continue;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const thisValue = (this as any)[name];

            if (value instanceof Expression) {
                return value.isEqual(thisValue as Expression<TType>);
            }

            return thisValue === value;
        }

        return true;
    }

    static walk(expression: Expression<string>, visitor: (expression: Expression<string>) => void) {
        visitor(expression);
        for (const value of Object.values(expression)) {
            if (value instanceof Expression) {
                Expression.walk(value, visitor);
            }
        }
    }
}
