import { BinaryExpressionBase } from './binary';
import { Expression } from './expression';
import { SourceExpression } from './source';
import { Type } from './type';

export class JoinClause extends BinaryExpressionBase<`JoinClause`, `==`> {
    expressionType = `JoinClause` as const;

    constructor(left: Expression<string>, right: Expression<string>) {
        super(left, `==`, right);
    }
}

export class JoinExpression extends Expression<`JoinExpression`> {
    expressionType = `JoinExpression` as const;
    source: SourceExpression;
    join: JoinClause[];

    get type(): Type {
        throw new Error(`type should not be used on JoinExpression`);
    }

    name: string;

    constructor(source: SourceExpression, join: JoinClause[], name?: string) {
        super();

        this.source = source;
        this.join = join;
        this.name = name ?? source.name;
    }
}
