import { Expression } from './expression.js';
import { BooleanType, NullType, NumberType, StringType, Type } from './type.js';

export class Literal extends Expression<`Literal`> {
    expressionType = `Literal` as const;
    value: string | number | boolean | null;
    type: Type;

    constructor(value: string | number | boolean | null | undefined) {
        super();

        if (value === undefined) {
            this.value = null;
            this.type = new NullType();
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
}
