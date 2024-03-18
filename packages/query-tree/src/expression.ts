export type ExpressionType = `BinaryExpression` | `LogicalExpression` | `VariableExpression` |
    `CallExpression` | `CaseExpression` | `CaseBlock` | `GlobalIdentifier` | `EntityIdentifier` |
    `FieldIdentifier` | `JoinExpression` | `JoinClause` | `Literal` | `SelectExpression` |
    `TernaryExpression` | `UnaryExpression` | `FromExpression` | `WhereExpression` |
    `GroupExpression` | `Alias`;

export type SelectExpressionType = `SelectExpression` | `JoinExpression`;
export type SourceExpressionType = `FromExpression` | `SelectExpression` | `WhereExpression` |
    `JoinExpression` | `GroupExpression`;
export type IdentifierExpressionType = `EntityIdentifier` | `FieldIdentifier` | `GlobalIdentifier`;

import { Type, isEqual as isTypeEqual } from './type.js';

export abstract class Expression<TType extends string = ExpressionType> {
    abstract expressionType: TType;
    abstract type: Type;
    
    isEqual(expression: Expression<TType>, ...ignore: string[]): boolean {
        if (ignore.includes(`type`) === false && isTypeEqual(this.type, expression.type) === false) {
            return false;
        }

        for (const [name, value] of Object.entries(expression)) {
            if (name === `type`) {
                continue;
            }

            if (ignore.includes(name)) {
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
}
