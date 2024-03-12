import { Expression } from './expression';
import { Type, UnionType } from './type';

export class CaseBlock extends Expression<`CaseBlock`> {
    expressionType = `CaseBlock` as const;
    type: Type;

    test: Expression<string>;
    consequent: Expression<string>;

    constructor(test: Expression<string>, consequent: Expression<string>) {
        super();
        this.test = test;
        this.consequent = consequent;
        this.type = consequent.type;
    }
}

export class CaseExpression extends Expression<`CaseExpression`> {
    expressionType = `CaseExpression` as const;
    type: Type;

    when: CaseBlock[];
    alternate: Expression<string>;

    constructor(when: CaseBlock[], alternate: Expression<string>) {
        super();
        this.when = when;
        this.alternate = alternate;

        const allTypes = [...when.map((w) => w.type), alternate.type];
        this.type = UnionType.possibleUnion(...allTypes);
    }
}
