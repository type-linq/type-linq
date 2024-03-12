import { Expression } from './expression';
import { Type, UnionType } from './type';

export class TernaryExpression extends Expression<`TernaryExpression`> {
    expressionType = `TernaryExpression` as const;
    type: Type;

    test: Expression<string>;
    consequent: Expression<string>;
    alternate: Expression<string>;

    constructor(test: Expression<string>, consequent: Expression<string>, alternate: Expression<string>) {
        super();
        this.test = test;
        this.consequent = consequent;
        this.alternate = alternate;
        this.type = UnionType.possibleUnion(consequent.type, alternate.type);
    }
}
