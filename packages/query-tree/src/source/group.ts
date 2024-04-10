import { Expression } from '../expression.js';
import { FieldSet } from './field.js';
import { Source } from './source.js';

export class GroupExpression extends Source {
    readonly by: FieldSet;

    get source() {
        return super.source!;
    }

    get fieldSet() {
        return this.source.fieldSet;
    }

    constructor(source: Source, by: FieldSet) {
        super(source);
        this.by = by;
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof GroupExpression === false) {
            return false;
        }

        return this.source.isEqual(expression.source) &&
            this.by.isEqual(expression.by);
    }

    rebuild(source: Source | undefined, by: FieldSet | undefined): Expression {
        return new GroupExpression(
            source ?? this.source,
            by ?? this.by,
        );
    }
    *walk() {
        yield this.source;
        yield this.by;
    }
}
