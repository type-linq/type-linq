import { Expression } from './expression.js';
import { Type, UnionType } from './type.js';

export class TernaryExpression extends Expression {
    type: Type;

    test: Expression;
    consequent: Expression;
    alternate: Expression;

    constructor(test: Expression, consequent: Expression, alternate: Expression) {
        super();

        this.test = test;
        this.consequent = consequent;
        this.alternate = alternate;
        this.type = UnionType.possibleUnion(consequent.type, alternate.type);
    }

    isEqual(expression?: Expression): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof TernaryExpression === false) {
            return false;
        }

        return this.test.isEqual(expression.test) &&
            this.consequent.isEqual(expression.consequent) &&
            this.alternate.isEqual(expression.alternate);
    }

    rebuild(test: Expression | undefined, consequent: Expression | undefined, alternate: Expression | undefined): TernaryExpression {
        return new TernaryExpression(
            test ?? this.test,
            consequent ?? this.consequent,
            alternate ?? this.alternate,
        );
    }

    *walk() {
        yield this.consequent;
        yield this.alternate;
        yield this.test;
    }
}
