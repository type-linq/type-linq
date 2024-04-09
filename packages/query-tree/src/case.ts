import { Expression } from './expression.js';
import { Type, UnionType } from './type.js';

export class CaseBlock extends Expression {
    type: Type;

    test: Expression;
    consequent: Expression;

    constructor(test: Expression, consequent: Expression) {
        super();
        this.test = test;
        this.consequent = consequent;
        this.type = consequent.type;
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof CaseBlock === false) {
            return false;
        }

        return this.test.isEqual(expression.test) &&
            this.consequent.isEqual(expression.consequent);
    }

    rebuild(test: Expression | undefined, consequent: Expression | undefined): Expression {
        return new CaseBlock(test ?? this.test, consequent ?? this.consequent);
    }

    *walk() {
        yield this.consequent;
        yield this.test;
    }
}

export class CaseBlocks extends Expression {
    type: Type;

    when: CaseBlock[];

    constructor(when: CaseBlock[]) {
        super();
        this.when = when;

        const allTypes = when.map((w) => w.type);
        this.type = UnionType.possibleUnion(...allTypes);
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof CaseBlocks === false) {
            return false;
        }

        return this.when.every(
            (when, idx) => when.isEqual(
                expression.when[idx]
            )
        );
    }

    rebuild(...when: CaseBlock[]): Expression {
        return new CaseBlocks(when);
    }

    *walk() {
        for (const when of this.when) {
            yield when;
        }
    }
}

export class CaseExpression extends Expression {
    type: Type;

    when: CaseBlocks;
    alternate: Expression;

    constructor(when: CaseBlocks, alternate: Expression) {
        super();
        this.when = when;
        this.alternate = alternate;

        const allTypes = [when.type, alternate.type];
        this.type = UnionType.possibleUnion(...allTypes);
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof CaseExpression === false) {
            return false;
        }

        return this.when.isEqual(expression.when) &&
            this.alternate.isEqual(expression.alternate);
    }

    rebuild(when: CaseBlocks | undefined, alternate: Expression | undefined): Expression {
        return new CaseExpression(when ?? this.when, alternate ?? this.alternate);
    }

    *walk() {
        yield this.when;
        yield this.alternate;
    }
}
