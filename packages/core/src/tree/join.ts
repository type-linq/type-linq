import { BinaryExpressionBase } from './binary';
import { Expression, ExpressionType } from './expression';
import { SourceExpression } from './source';
import { Type } from './type';

export class JoinClause extends BinaryExpressionBase<`JoinClause`, `==`> {
    expressionType = `JoinClause` as const;

    constructor(left: Expression<ExpressionType>, right: Expression<ExpressionType>) {
        super(left, `==`, right);
    }
}

// TODO: How can this be right!?
// Because it gets added to the select....

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
