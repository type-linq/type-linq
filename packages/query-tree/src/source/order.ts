import { Expression } from '../expression.js';
import { Source } from './source.js';

export class OrderExpression extends Source {
    readonly descending: boolean;
    readonly expression: Expression;

    get source() {
        return super.source!;
    }

    get fieldSet() {
        return this.source.fieldSet;
    }

    constructor(source: Source, expression: Expression, descending = false) {
        super(source);
        this.expression = expression;
        this.descending = descending;
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof OrderExpression === false) {
            return false;
        }

        return this.source.isEqual(this.source) &&
            this.expression.isEqual(expression.expression) &&
            this.descending === expression.descending;
    }

    protected rebuild(source: Source | undefined, expression: Expression | undefined): Expression {
        return new OrderExpression(
            source ?? this.source,
            expression ?? this.expression,
            this.descending,
        );
    }

    *walk() {
        yield this.source;
        yield this.expression;
    }

}