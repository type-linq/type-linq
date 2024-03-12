import { Expression } from './expression';
import { Type } from './type';

export class Identifier extends Expression<`Identifier`> {
    expressionType = `Identifier` as const;
    type: Type;
    name: string;

    constructor(name: string, type: Type) {
        super();
        this.name = name;
        this.type = type;
    }
}
