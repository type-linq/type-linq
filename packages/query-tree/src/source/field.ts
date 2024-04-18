import { Expression } from '../expression.js';
import { FieldIdentifier, Identifier } from '../identifier.js';
import { EntityType, Type, isEqual, isScalar } from '../type.js';
import { Walker } from '../walk.js';
import { Boundary, EntitySource, SubSource } from './entity.js';
import { GroupExpression } from './group.js';
import { JoinExpression } from './join.js';
import { OrderExpression } from './order.js';
import { SkipExpression, TakeExpression } from './range.js';
import { SelectExpression } from './select.js';
import { Source } from './source.js';
import { WhereExpression } from './where.js';

export class Field extends Expression {
    readonly name: Identifier;
    readonly expression: Expression;

    get type() {
        return this.expression.type;
    }

    constructor(source: Expression, name: string) {
        super();
        this.name = new Identifier(name);
        this.expression = source;
    }

    *walk() {
        yield this.expression;
    }

    *walkBranch() {
        yield this.expression;
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

    rebuild(expression: Expression | undefined): Field {
        return new Field(expression ?? this.expression, this.name.name);
    }

    boundary(boundaryId: string) {
        return Walker.map(this, (exp) => {
            if (exp instanceof FieldIdentifier === false) {
                return exp;
            }
            return new FieldIdentifier(
                new Boundary(exp.entity, boundaryId),
                exp.name,
                exp.type,
            );
        }) as Field;
    }

    subSource() {
        if (this.expression instanceof Source === false) {
            return this;
        }

        switch (true) {
            case this.expression instanceof EntitySource:
            case this.expression instanceof SelectExpression:
                return this;
            default:
                break;
        }

        return new Field(
            new SubSource(this.expression),
            this.name.name,
        );
    }

    ingest(source: Source) {
        if (this.expression instanceof Source === false) {
            return;
        }

        const ignore = (exp: Expression) => exp instanceof GroupExpression &&
            exp instanceof TakeExpression &&
            exp instanceof SkipExpression &&
            exp instanceof OrderExpression;

        const expression = Walker.mapSource(this.expression, (exp) => {
            switch (true) {
                case exp instanceof EntitySource:
                case exp instanceof SelectExpression:
                    return exp;
                case exp instanceof WhereExpression:
                    throw new Error(`not implemented`);
                case exp instanceof JoinExpression:
                    throw new Error(`not implemented`);
                default:
                    throw new Error(
                        `Unexpected expression type "${exp.constructor.name}" received`
                    );
            }
        }, undefined, ignore);

        if (ignore(expression)) {
            // TODO: Sub source.... but... we need to share the same sub source between different fields!!!!!
            //  Perhaps FieldSet is the place?
            throw new Error(`not implemented`);
        }
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
            this.#type = result;
            return result;
        }

        if (this.#type) {
            return this.#type;
        }

        if (this.scalar) {
            this.#type = this.field.type;
            return this.field.type;
        }

        const type = new EntityType(this);
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

    scalars() {
        const fields = this.fields.filter(
            (field) => isScalar(field.type)
        );
        return new FieldSet(fields);
    }

    boundary(boundaryId: string) {
        const fields = this.fields.filter(
            (field) => field.boundary(boundaryId)
        );
        return new FieldSet(fields);
    }
}

