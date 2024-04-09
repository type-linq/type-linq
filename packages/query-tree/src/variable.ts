import cloneDeep from 'lodash.clonedeep';
import isEqual from 'lodash.isequal';
import { Expression } from './expression.js';
import { BooleanType, DateType,  NumberType, StringType, Type, UnknownType, scalarUnion } from './type.js';

export class VariableExpression<TBound = unknown> extends Expression {
    type: Type;
    path: string[];
    bound?: TBound;

    constructor(path: string[], bound?: TBound) {
        // We make a deep copy since the variable needs to
        //  be as it was when the function was declared.
        if (bound) {
            bound = cloneDeep(bound);
        }

        super();
        this.path = path;
        this.bound = bound;

        if (bound === undefined) {
            this.type = scalarUnion;
            return;
        }

        const value = this.access();

        if (value === null) {
            this.type = new UnknownType();
            return;
        }

        if (value instanceof Date) {
            this.type = new DateType();
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
                this.type = new UnknownType();
                break;
            case `function`:
            case `object`:
            case `symbol`:
            default:
                throw new Error(`Unsupported value type "${typeof value}" received`);
        }
    }

    access(supplied?: unknown): unknown {
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
                const name = items.shift()!;
                if (name in current === false) {
                    const missing = this.path.slice(0, this.path.length - items.length);
                    throw new Error(
                        `Unable to find identifier on vars "${missing.join(`.`)}"`
                    );
                }
                current = current[name];                
            }
            return current;
        }

        throw new Error(`vars is not an object yet an access path is assigned to the VariableExpression`);
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof VariableExpression === false) {
            return false;
        }

        const isBoundSame = isEqual(this.bound, expression.bound);
        const isPathSame = expression.path.every((p, i) => p === this.path[i]);

        return isBoundSame && isPathSame;
    }

    rebuild(): VariableExpression {
        return this;
    }

    *walk() { }
}
