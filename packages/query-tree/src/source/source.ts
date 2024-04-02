import { Expression } from '../expression.js';
import { boundary } from '../util.js';
import { FieldSet } from './field.js';

export abstract class Source extends Expression {
    abstract readonly fieldSet: FieldSet;

    #source?: Source;

    get type() {
        return this.fieldSet.type;
    }

    get source() {
        return this.#source;
    }

    protected set source(value: Source | undefined) {
        this.#source = value;
    }

    constructor(source?: Source) {
        super();
        this.#source = source;
    }

    boundary(boundaryId?: string): this {
        return boundary(this, boundaryId);
    }
}
