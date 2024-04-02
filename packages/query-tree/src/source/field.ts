import { Expression } from '../expression.js';
import { Identifier } from '../identifier.js';
import { EntityType, Type, TypeFields, isEqual } from '../type.js';
import { randString } from '../util.js';

export class Field extends Expression {
    readonly name: Identifier;
    readonly #source: Expression | (() => Expression);

    get source() {
        if (typeof this.#source === `function`) {
            return this.#source();
        } else {
            return this.#source;
        }
    }

    get type() {
        return this.source.type;
    }

    constructor(source: Expression | (() => Expression), name: string) {
        super();
        this.name = new Identifier(name);
        this.#source = source;
    }

    *walk() {
        // TODO: This can be circular....
        // We need to somehow ignore entity sources....
        // (And perhaps just walk yield entity identifier?)

        yield this.source;
    }

    *walkBranch() {
        yield this.source;
    }

    isEqual(expression: Expression): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof Identifier === false) {
            return false;
        }
        return expression.name === this.name.name &&
            isEqual(expression.type, this.type);
    }

    rebuild(source: Expression | undefined): Field {
        return new Field(source ?? this.source, this.name.name);
    }

    boundary(boundaryId?: string) {
        return new Field(
            new Boundary(this.source, boundaryId),
            this.name.name,
        );
    }
}

export class FieldSet extends Expression {
    #type?: Type | (() => Type | undefined);

    readonly scalar: boolean;
    readonly fields: Field[];

    get field() {
        if (this.scalar) {
            return this.fields[0];
        }
        throw new Error(`FieldSet does not represent a scalar`);
    }

    get type() {
        if (typeof this.#type === `function`) {
            const result = this.#type();
            if (result === undefined) {
                throw new Error(`Type function returned undefined`);
            }
            return result;
        }

        if (this.#type) {
            return this.#type;
        }

        if (this.scalar) {
            return this.field.type;
        }

        const cols: TypeFields = this.fields.reduce(
            (result, field) => {
                result[field.name.name] = field.type;
                return result;
            },
            { } as TypeFields,
        );

        const type = new EntityType(cols);
        this.#type = type;
        return type;
    }

    constructor(fields: Field | Field[], type?: Type | (() => Type | undefined)) {
        super();

        if (Array.isArray(fields)) {
            if (fields.length === 0) {
                throw new Error(`fields MUST have at least one value`);
            }
            this.scalar = false;
        }

        this.scalar = Array.isArray(fields) === false;
        this.fields = Array.isArray(fields) ?
            fields :
            [fields];
        this.#type = type;
    }

    *[Symbol.iterator]() {
        if (Array.isArray(this.fields) === false) {
            yield this.fields;
            return;
        }

        for (const field of this.fields) {
            yield field;
        }
    }

    find(name: string) {
        return this.fields.find(
            (field) => field.name.name === name
        );
    }

    isEqual(expression?: Expression): boolean {
        if (expression instanceof FieldSet === false) {
            return false;
        }

        const fields1 = Array.from(this);
        const fields2 = Array.from(expression);

        return Array.from(fields1).every(
            (field1, index) => field1.isEqual(fields2[index])
        )
    }

    *walk() {
        for (const field of this) {
            yield field;
        }
    }

    rebuild(...fields: Field[]): FieldSet {
        if (fields === undefined) {
            return this;
        }

        if (this.scalar) {
            return new FieldSet(fields[0]);
        }

        return new FieldSet(fields);
    }

    boundary(boundaryId: string) {
        return new FieldSet(
            this.fields.map(
                (field) => field.boundary(boundaryId)
            ),
            this.type,
        )
    }
}

export class Boundary<TExpression extends Expression = Expression> extends Expression {
    readonly identifier: string;
    readonly expression: TExpression;

    get type() {
        return this.expression.type;
    }

    constructor(expression: TExpression, identifier = randString()) {
        super();
        this.expression = expression;
        this.identifier = identifier;
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof Boundary === false) {
            return false;
        }

        return this.identifier === expression.identifier &&
            this.expression.isEqual(expression.expression);
    }

    protected rebuild(expression: Expression): Expression {
        return new Boundary(expression, this.identifier);
    }

    *walk() {
        yield this.expression;
    }
}
