import { Expression } from './expression.js';
import { BooleanType, DateType, NullType, NumberType, StringType, Type } from './type.js';

export type LiteralValue = string | number | boolean | Date | null | undefined

export class Literal extends Expression {
    value: LiteralValue;
    type: Type;

    constructor(value: LiteralValue) {
        super();

        if (value === undefined || value === null) {
            this.value = null;
            this.type = new NullType();
            return;
        }

        if (value instanceof Date) {
            this.type = new DateType();
            return;
        }

        this.value = value;
        switch (typeof value) {
            case `string`:
                this.type = new StringType();
                break;
            case `number`:
                this.type = new NumberType();
                break;
            case `boolean`:
                this.type = new BooleanType();
                break;
            default:
                throw new Error(`Invalid type "${typeof value}" received`);
        }
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof Literal === false) {
            return false;
        }
        return this.value === expression.value;
    }

    rebuild(): Literal {
        return this;
    }

    *walk() { }
}
