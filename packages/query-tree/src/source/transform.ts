import { Expression } from '../expression.js';
import { Source } from './source.js';

export type SetTransform = (results: unknown[]) => unknown;
export type ItemTramsform = (result: unknown) => unknown;

export class TransformExpression extends Source {
    readonly set?: SetTransform;
    readonly item?: ItemTramsform;

    get source() {
        return super.source!;
    }

    get fieldSet() {
        return this.source.fieldSet;
    }

    constructor(source: Source, item?: ItemTramsform, set?: SetTransform) {
        super(source);

        this.item = item;
        this.set = set;
    }


    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof TransformExpression === false) {
            return false;
        }

        return this.source.isEqual(expression.source) &&
            this.set === expression.set &&
            this.item === expression.item;
    }

    rebuild(source: Source): Expression {
        return new TransformExpression(source, this.item, this.set);
    }

    *walk() {
        yield this.source;
    }
}