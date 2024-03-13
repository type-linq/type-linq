import { Serializable } from '../type';
import { Expression } from './expression';
import { BooleanType, NullType, NumberType, StringType, Type, UnionType } from './type';

export class VariableExpression extends Expression<`VariableExpression`> {
    expressionType = `VariableExpression` as const;
    type: Type;
    path: string[];
    bound: Serializable;

    constructor(path: string[], bound?: Serializable) {
        super();
        this.path = path;
        this.bound = bound;

        if (bound === undefined) {
            this.type = new UnionType(
                new BooleanType(),
                new StringType(),
                new NumberType(),
            );
            return;
        }

        const value = this.access();

        if (value === null) {
            this.type = new NullType();
            return;
        }

        switch (typeof value) {
            case `bigint`:
            case `number`:
                this.type = new NumberType();
                break;
            case `boolean`:
                this.type = new BooleanType();
                break;
            case `string`:
                this.type = new StringType();
                break;
            case `undefined`:
                this.type = new NullType();
                break;
            case `function`:
            case `object`:
            case `symbol`:
            default:
                throw new Error(`Unsupported value type "${typeof value}" received`);
        }
    }

    access(supplied?: Serializable): Serializable {
        const vars = supplied === undefined ?
            this.bound :
            supplied;

        if (this.path.length === 0) {
            return vars;
        }

        if (vars === undefined || vars === null) {
            // TODO: We should probably throw an exception here
            return undefined;
        }

        if (vars && typeof vars === `object`) {
            const items = this.path.slice();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let current = vars as any;
            while (items.length) {
                current = current[items.shift()!];
                if (!current) {
                    const missing = this.path.slice(0, this.path.length - items.length);
                    throw new Error(
                        `Unable to find identifier on vars "${missing.join(`.`)}"`
                    );
                }
                
            }
            return current;
        }

        throw new Error(`vars is not an object yet an access path is assigned to the VariableExpression`);
    }
}
