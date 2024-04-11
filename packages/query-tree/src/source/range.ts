import { Expression } from '../expression.js';
import { Source } from './source.js';

export class SkipExpression extends Source {
    readonly count: number;

    get source() {
        return super.source!;
    }

    get fieldSet() {
        return this.source.fieldSet;
    }

    constructor(source: Source, count: number) {
        super(source);
        this.count = count;
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

    rebuild(source: Source): Expression {
        return new SkipExpression(source, this.count);
    }

    *walk() {
        yield this.source;
    }
}

export class TakeExpression extends Source {
    readonly count: number;

    get source() {
        return super.source!;
    }

    get fieldSet() {
        return this.source.fieldSet;
    }

    constructor(source: Source, count: number) {
        super(source);
        this.count = count;
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

    rebuild(source: Source): Expression {
        return new TakeExpression(source, this.count);
    }

    *walk() {
        yield this.source;
    }
}
