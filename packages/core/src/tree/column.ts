import { Expression, ExpressionType } from './expression';
import { Identifier } from './identifier';
import { SourceExpression } from './source';
import { Type } from './type';

export class Column extends Expression<`Column`> {
    expressionType = `Column` as const;

    expression: Expression<ExpressionType>;
    name: string;
    linkChain: Record<string, SourceExpression[]>;

    get type() {
        return this.expression.type;
    }

    constructor(expression: Expression<ExpressionType>, name: string, columnType: undefined, linkChain: Record<string, SourceExpression[]>);
    constructor(expression: Expression<ExpressionType>, name: string);
    constructor(expression: string, name: string, columnType: Type);
    constructor(expression: string, name: string, columnType: Type, linkChain: Record<string, SourceExpression[]>);
    constructor(expression: Expression<ExpressionType> | string, name: string, columnType?: Type, linkChain: Record<string, SourceExpression[]> = {}) {
        super();

        if (typeof expression === `string`) {
            if (columnType === undefined) {
                throw new Error(`When expression is a string, columnType MUST be supplied`);
            }
            this.expression = new Identifier(expression, columnType!);
        } else {
            if (columnType !== undefined) {
                throw new Error(`When expression is not a string, columnType MUST NOT be supplied`);
            }
            this.expression = expression;
        }

        this.name = name;
        this.linkChain = linkChain;
    }
}
