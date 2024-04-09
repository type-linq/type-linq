import { Type } from './type.js';

export abstract class Expression {
    abstract readonly type: Type;

    abstract isEqual(expression?: Expression): boolean;
    abstract rebuild(...args: (Expression | undefined)[]): Expression;
    abstract walk(): Generator<Expression>;

    #shouldRebuild(original: Expression[], updated: (Expression | undefined)[]) {
        if (original.length !== updated.length) {
            throw new Error(`Expected original and updated lengths to match`);
        }

        if (updated.every((upd) => upd === undefined)) {
            return false;
        }

        for (let index = 0; index < original.length; index++) {
            const updat = updated[index];
            if (updat === undefined) {
                continue;
            }

            if (original[index].isEqual(updat) === false) {
                return true;
            }
        }

        return false;
    }

    mutate(updated: (Expression | undefined)[]) {
        const rebuildValues = Array.from(this.walk());
        if (this.#shouldRebuild(rebuildValues, updated) === false) {
            return this;
        }
        return this.rebuild(...updated);
    }
}
