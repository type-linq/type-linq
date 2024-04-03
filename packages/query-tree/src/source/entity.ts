import { Expression } from '../expression.js';
import { EntityIdentifier } from '../identifier.js';
import { FieldSet } from './field.js';
import { Source } from './source.js';
import { WhereClause } from './where.js';

export class EntitySource extends Source {

    // TODO: We actually need the FieldSet type here not to be dynamic......

    readonly entity: EntityIdentifier;
    readonly fieldSet: FieldSet;

    get source() {
        return undefined;
    }

    constructor(entity: EntityIdentifier, fieldSet: FieldSet) {
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

    rebuild(entity: EntityIdentifier | undefined, fieldSet: FieldSet | undefined): EntitySource {
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

export class LinkedEntitySource extends Source {
    #source: EntitySource | (() => EntitySource);
    #linked: EntitySource | LinkedEntitySource | (() => EntitySource | LinkedEntitySource);
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
        linked: EntitySource | LinkedEntitySource | (() => EntitySource | LinkedEntitySource),
        source: EntitySource | (() => EntitySource),
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
        linked: EntitySource | undefined,
        source: EntitySource | undefined,
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