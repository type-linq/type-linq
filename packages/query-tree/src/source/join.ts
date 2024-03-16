import { BinaryExpressionBase } from '../binary';
import { Expression } from '../expression';
import { SourceExpression } from './source';
import { Type } from '../type';

export class JoinClause extends BinaryExpressionBase<`JoinClause`, `==`> {
    expressionType = `JoinClause` as const;

    constructor(left: Expression, right: Expression) {
        super(left, `==`, right);
    }
}

export class JoinExpression extends SourceExpression<`JoinExpression`> {
    expressionType = `JoinExpression` as const;

    joined: SourceExpression;
    join: JoinClause[];

    get source() {
        return super.source!;
    }

    get fields() {
        return this.source.fields;
    }

    get type(): Type {
        return this.source.type;
    }

    constructor(source: SourceExpression, joined: SourceExpression, join: JoinClause[]) {
        super(source);
        this.join = join;
        this.joined = joined;
    }
}
