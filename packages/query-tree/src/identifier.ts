import { Expression } from './expression.js';
import { EntitySource, LinkedEntitySource, SubSource } from './index.js';
import { EntityType, Type, UnknownType, isEqual } from './type.js';

export class Identifier extends Expression {
    readonly name: string;

    get type() {
        return new UnknownType() as Type;
    }

    constructor(name: string) {
        super();
        this.name = name;
    }

    isEqual(expression?: Expression): boolean {
        if (expression instanceof Identifier === false) {
            return false;
        }
        return expression.name === this.name;
    }

    protected rebuild(identifier: Expression): Identifier {
        return this;
    }
    
    *walk(): Generator<Expression, void, unknown> { }
}

export class GlobalIdentifier extends Identifier {
    readonly #type: Type;

    get type() {
        return this.#type;
    }

    constructor(name: string, type: Type) {
        super(name);
        this.#type = type;
    }

    *walk() { }

    isEqual(expression?: Expression): boolean {
        if (expression instanceof GlobalIdentifier === false) {
            return false;
        }
        return expression.name === this.name &&
            isEqual(expression.type, this.type);
    }

    rebuild(): GlobalIdentifier {
        return this;
    }
}

export class EntityIdentifier extends Identifier {
    readonly #type: Type;

    get type() {
        return this.#type;
    }

    constructor(name: string, type: EntityType) {
        super(name);
        this.#type = type;
    }

    *walk() { }
}

export type FieldSource = EntitySource | LinkedEntitySource | SubSource;

export class FieldIdentifier extends Identifier {
    readonly #entity: FieldSource | (() => FieldSource);
    readonly #type: Type | (() => Type | undefined);

    get entity() {
        if (typeof this.#entity === `function`) {
            const result = this.#entity();
            if (result === undefined) {
                throw new Error(`Unable to get entity`);
            }
            return result;
        } else {
            return this.#entity;
        }
    }

    get source(): FieldSource {
        if (this.entity instanceof LinkedEntitySource) {
            return this.entity.source;
        }
        return this.entity;
    }

    get type() {
        if (typeof this.#type === `function`) {
            const result = this.#type();
            if (result === undefined) {
                throw new Error(`Unable to get type`);
            }
            return result;
        } else {
            return this.#type;
        }
    }
    
    constructor(
        entity: FieldSource | (() => FieldSource),
        name: string,
        type: Type | (() => Type | undefined)
    ) {
        super(name);
        this.#entity = entity;
        this.#type = type;
    }

    protected rebuild(entity: FieldSource): Identifier {
        return new FieldIdentifier(entity, this.name, this.type);
    }

    *walk() {
        yield this.entity;
    }
}
