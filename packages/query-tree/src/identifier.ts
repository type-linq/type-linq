import { Expression } from './expression.js';
import { EntitySource } from './source/entity.js';
import { Source } from './source/source.js';
import { EntityType, Type, UnknownType, isEqual } from './type.js';
import { LateBound, lateBound } from './util.js';

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

    rebuild(identifier: Expression): Identifier {
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
}

export class FieldIdentifier extends Identifier {
    readonly #entity: () => EntitySource;
    readonly #type: () => Type;

    get entity() {
        return this.#entity();
    }

    get type() {
        return this.#type();
    }
    
    constructor(
        entity: LateBound<EntitySource>,
        name: string,
        type: LateBound<Type>
    ) {
        super(name);
        this.#entity = lateBound(entity);
        this.#type = lateBound(type);
    }

    rebuild(entity: EntitySource): Identifier {
        return new FieldIdentifier(entity, this.name, this.type);
    }

    /**
     * Adds any LinkedEntities as joins to the source, and returns the
     * new source, and the field without LinkedEntities
     */
    applyLinked(source: Source) {
        return this.entity.applyLinked(source);
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof FieldIdentifier === false) {
            return false;
        }

        return super.isEqual(expression) &&
            this.entity.isEqual(expression.entity);
    }
}
