import { Expression } from '../expression.js';
import { Literal } from '../literal.js';
import { Source } from './source.js';

// TODO: These are wrong... 
//  The counts need to be able to accept expressions... (e.g. vars....)

export class SkipExpression extends Source {
    readonly count: Expression;

    get source() {
        return super.source!;
    }

    get fieldSet() {
        return this.source.fieldSet;
    }

    constructor(source: Source, count: Expression | number) {
        super(source);

        if (typeof count === `number`) {
            this.count = new Literal(count);
        } else {
            this.count = count;
        }
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof SkipExpression === false) {
            return false;
        }

        return this.source.isEqual(expression.source) &&
            this.count === expression.count;
    }

    rebuild(source: Source | undefined, count: Expression | undefined): SkipExpression {
        return new SkipExpression(
            source ?? this.source,
            count ?? this.count,
        );
    }

    *walk() {
        yield this.source;
    }
}

export class TakeExpression extends Source {
    readonly count: Expression;

    get source() {
        return super.source!;
    }

    get fieldSet() {
        return this.source.fieldSet;
    }

    constructor(source: Source, count: Expression | number) {
        super(source);

        if (typeof count === `number`) {
            this.count = new Literal(count);
        } else {
            this.count = count;
        }
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof TakeExpression === false) {
            return false;
        }

        return this.source.isEqual(expression.source) &&
            this.count === expression.count;
    }

    rebuild(source: Source | undefined, count: Expression | undefined): TakeExpression {
        return new TakeExpression(
            source ?? this.source,
            count ?? this.count,
        );
    }

    *walk() {
        yield this.source;
    }
}
