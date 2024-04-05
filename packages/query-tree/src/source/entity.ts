import { Expression } from '../expression.js';
import { EntityIdentifier, FieldSource } from '../identifier.js';
import { Boundary, FieldSet } from './field.js';
import { Source } from './source.js';
import { SubSource } from './sub.js';
import { WhereClause } from './where.js';

export class EntitySource extends Source {

    // TODO: We actually need the FieldSet type here not to be dynamic......

    readonly entity: EntityIdentifier | Boundary<EntityIdentifier>;
    readonly fieldSet: FieldSet;

    get source() {
        return undefined;
    }

    constructor(entity: EntityIdentifier | Boundary<EntityIdentifier>, fieldSet: FieldSet) {
        super();

        this.entity = entity;
        this.fieldSet = fieldSet;
    }

    isEqual(expression?: Expression): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof EntitySource === false) {
            return false;
        }

        if (this.entity.isEqual(expression.entity) === false) {
            return false;
        }

        if (this.fieldSet.isEqual(expression.fieldSet) === false) {
            return false;
        }

        return true;
    }

    rebuild(entity: EntityIdentifier | Boundary<EntityIdentifier> | undefined, fieldSet: FieldSet | undefined): EntitySource {
        return new EntitySource(
            entity ?? this.entity,
            fieldSet ?? this.fieldSet,
        );
    }

    *walk() {
        yield this.entity;
        yield this.fieldSet;
    }
}

export type LinkedSource = EntitySource | SubSource;

export class LinkedEntitySource extends Source {
    #source: LinkedSource | (() => LinkedSource);
    #linked: FieldSource | (() => FieldSource);
    clause: WhereClause;

    get source() {
        if (typeof this.#source === `function`) {
            const result = this.#source();
            if (result === undefined) {
                throw new Error(`Unable to get source`);
            }
            this.#source = result;
            return result;
        } else {
            return this.#source;
        }
    }

    get linked() {
        if (typeof this.#linked === `function`) {
            const result = this.#linked();
            if (result === undefined) {
                throw new Error(`Unable to get linked`);
            }
            this.#linked = result;
            return result;
        } else {
            return this.#linked;
        }
    }

    get fieldSet() {
        return this.source.fieldSet;
    }

    constructor(
        linked: FieldSource | (() => FieldSource),
        source: LinkedSource | (() => LinkedSource),
        clause: WhereClause,
    ) {
        super();
        this.#linked = linked;
        this.#source = source;
        this.clause = clause;
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof LinkedEntitySource === false) {
            return false;
        }

        return this.source.isEqual(expression.source) &&
            this.linked.isEqual(expression.linked) &&
            this.clause.isEqual(expression.clause);
    }

    protected rebuild(
        linked: FieldSource | undefined,
        source: LinkedSource | undefined,
        clause: WhereClause | undefined
    ): Expression {
        return new LinkedEntitySource(
            linked ?? this.linked,
            source ?? this.source,
            clause ?? this.clause,
        );
    }

    *walk() {
        yield this.linked;
        yield this.source;
        yield this.clause;
    }
}