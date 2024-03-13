import { Expression, ExpressionType } from './expression';
import { SourceExpression } from './source';

export class Column extends Expression<`Column`> {
    expressionType = `Column` as const;

    expression: Expression<ExpressionType>;
    name: string;
    linkMap: Map<SourceExpression, SourceExpression[]>;

    get type() {
        return this.expression.type;
    }

    constructor(expression: Expression<ExpressionType>, name: string, linkMap: Map<SourceExpression, SourceExpression[]>);
    constructor(expression: Expression<ExpressionType>, name: string);
    constructor(expression: Expression<ExpressionType>, name: string, linkMap = new Map<SourceExpression, SourceExpression[]>()) {
        super();

        this.expression = expression;
        this.name = name;
        this.linkMap = linkMap;
    }
}
