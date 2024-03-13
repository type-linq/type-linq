import { Expression, ExpressionType } from './expression';
import { Type, UnionType } from './type';

export class TernaryExpression extends Expression<`TernaryExpression`> {
    expressionType = `TernaryExpression` as const;
    type: Type;

    test: Expression<ExpressionType>;
    consequent: Expression<ExpressionType>;
    alternate: Expression<ExpressionType>;

    constructor(test: Expression<ExpressionType>, consequent: Expression<ExpressionType>, alternate: Expression<ExpressionType>) {
        super();
        this.test = test;
        this.consequent = consequent;
        this.alternate = alternate;
        this.type = UnionType.possibleUnion(consequent.type, alternate.type);
    }
}
