export type ExpressionType = `BinaryExpression` | `LogicalExpression` | `VariableExpression` |
    `CallExpression` | `CaseBlock` | `Column` | `GlobalExpression` | `Identifier` | `JoinClause` |
    `JoinExpression` | `Literal` | `SelectExpression` | `SourceExpression` | `TernaryExpression` |
    `UnaryExpression`;

import { Type } from './type';

export abstract class Expression<TType extends string> {
    abstract expressionType: TType;
    abstract type: Type;
}
