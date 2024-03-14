export type ExpressionType = `BinaryExpression` | `LogicalExpression` | `VariableExpression` |
    `CallExpression` | `CaseExpression` | `CaseBlock` | `Column` | `GlobalExpression` | `Identifier` |
    `JoinExpression` | `Literal` | `SelectExpression` | `SourceExpression` | `TernaryExpression` |
    `UnaryExpression`;

import { Type, areTypesEqual } from './type';

export abstract class Expression<TType extends string> {
    abstract expressionType: TType;
    abstract type: Type;
    
    isEqual(expression: Expression<TType>): boolean {
        if (expression.expressionType !== `JoinExpression`) {
            if (areTypesEqual(this.type, expression.type) === false) {
                return false;
            }
        }

        for (const [name, value] of Object.entries(expression)) {
            if (name === `type`) {
                continue;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const thisValue = (this as any)[name];
            if (areEqual(thisValue, value) === false) {
                return false;
            }
        }

        return true;

        function areEqual(thisValue: unknown, value: unknown) {
            if (Array.isArray(thisValue) !== Array.isArray(value)) {
                return false;
            }

            if (Array.isArray(thisValue) && Array.isArray(value)) {
                if (thisValue.length !== value.length) {
                    return false;
                }
                for (let index = 0; index < thisValue.length; index++) {
                    const element1 = thisValue[index];
                    const element2 = value[index];

                    if (areEqual(element1, element2) === false) {
                        return false;
                    }
                }
            }

            if (value instanceof Expression && thisValue instanceof Expression) {
                return value.isEqual(thisValue);
            }

            return thisValue === value;
        }
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
