import { Expression } from '../expression.js';
import { EntityIdentifier, FieldIdentifier } from '../identifier.js';
import { EntitySet, EntityType } from '../type.js';
import { LateBound, lateBound, randString } from '../util.js';
import { Walker } from '../walk.js';
import { FieldSet } from './field.js';
import { JoinExpression } from './join.js';
import { Source } from './source.js';
import { WhereClause } from './where.js';

export type BoundedEntitySource = Boundary<EntitySource>;
export type BoundaryEntity = Entity | Boundary<BoundaryEntity>;

export abstract class EntitySource extends Source {
    get source(): EntitySource | undefined {
        return super.source as EntitySource;
    }

    constructor(source?: EntitySource) {
        super(source);
    }

    /** Returns all links the entity source contains */
    abstract links(): LinkedEntity[];

    /** Creates a linked entity source with a boundary */
    link(source: EntitySource, clause: WhereClause, identifier = randString()): LinkedEntity {
        return new LinkedEntity(
            new Boundary(source, identifier),
            this,
            clause,
        );
    }

    applyLinked(source: Source) {
        const links = this.links();

        if (links.length === 0) {
            return source;
        }

        let current = source;
        for (const link of links) {
            current = new JoinExpression(
                current,
                link.source,
                link.clause,
            );
        }

        const joins: JoinExpression[] = [];
        const deduped = Walker.mapSource(current, (exp) => {
            if (exp instanceof JoinExpression === false) {
                return exp;
            }

            const existing = joins.find(
                (join) => join.joined.isEqual(exp.joined) &&
                    join.condition.isEqual(exp.condition)
            );

            if (existing) {
                return exp.source;
            }

            joins.push(exp);
            return exp;
        });

        return deduped;
    }
}

export class Entity extends EntitySource {
    readonly identifier: EntityIdentifier;
    readonly fieldSet: FieldSet;

    get source() {
        return undefined;
    }

    constructor(identifier: EntityIdentifier, fieldSet: FieldSet) {
        super();

        this.identifier = identifier;
        this.fieldSet = fieldSet;
    }

    links() {
        return [];
    }

    isEqual(expression?: Expression): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof Entity === false) {
            return false;
        }

        if (this.identifier.isEqual(expression.identifier) === false) {
            return false;
        }

        if (this.fieldSet.isEqual(expression.fieldSet) === false) {
            return false;
        }

        return true;
    }

    rebuild(entity: Expression | undefined, fieldSet: FieldSet | undefined): Entity {
        return new Entity(
            entity as EntityIdentifier ?? this.identifier,
            fieldSet ?? this.fieldSet,
        );
    }

    *walk() { }
}

export class Boundary<TSource extends EntitySource = EntitySource> extends EntitySource {
    readonly identifier: string;

    get source() {
        return super.source! as TSource;
    }

    get fieldSet(): FieldSet {
        return this.source.fieldSet;
    }

    constructor(source: TSource, identifier = randString()) {
        super(source);

        this.identifier = identifier;
    }

    links(): LinkedEntity[] {
        return this.source.links();
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof Boundary === false) {
            return false;
        }

        return this.identifier === expression.identifier &&
            this.source.isEqual(expression.source);
    }

    rebuild(expression: EntitySource): Boundary<EntitySource> {
        if (expression instanceof EntitySource === false) {
            throw new Error(`Boundary MUST be rebuilt with an EntitySource`);
        }
        return new Boundary(expression, this.identifier);
    }

    *walk() {
        yield this.source;
    }
}

export class LinkedEntity extends EntitySource {
    #source: () => BoundedEntitySource;
    #linked: () => EntitySource;
    #fieldSet?: FieldSet;
    #clause: () => WhereClause;

    #setType?: EntitySet;
    readonly set?: boolean;

    get type() {
        if (this.#setType) {
            return this.#setType;
        }

        if (this.set) {
            this.#setType = new EntitySet(this.fieldSet);
            return this.#setType;
        } else {
            return this.fieldSet.type;
        }
    }

    // TODO: Add set here?
    //  But type is in FieldSet....
    //  Maybe just a set wrapper?

    // Perhaps we just adjust the type of the LinkedEntity......

    get source(): BoundedEntitySource {
        return this.#source();
    }

    get linked(): EntitySource {
        return this.#linked();
    }

    get clause() {
        return this.#clause();
    }

    get fieldSet() {
        if (this.#fieldSet) {
            return this.#fieldSet;
        }

        const result = Walker.map(this.source.fieldSet, (exp) => {
            if (exp instanceof FieldIdentifier === false) {
                return exp;
            }

            const boundaryId = this.source.identifier;

            return new FieldIdentifier(
                new LinkedEntity(
                    new Boundary(
                        exp.entity,
                        boundaryId
                    ),
                    this.linked,
                    this.clause,
                ),
                exp.name,
                exp.type,
            );
        }) as FieldSet;
        this.#fieldSet = result;
        return this.#fieldSet;
    }

    constructor(
        // TODO: Source has to be first!
        source: LateBound<BoundedEntitySource>,
        linked: LateBound<EntitySource>,
        clause: LateBound<WhereClause>,
        set?: boolean,
    ) {
        super();

        this.#linked = lateBound(linked);
        this.#source = lateBound(source);
        this.#clause = lateBound(clause);
        this.set = set;
    }

    links(): LinkedEntity[] {
        return [this, ...this.source.links()];
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof LinkedEntity === false) {
            return false;
        }

        return this.source.isEqual(expression.source) &&
            this.linked.isEqual(expression.linked) &&
            this.clause.isEqual(expression.clause) &&
            Boolean(this.set) === Boolean(expression.set);
    }

    rebuild(
        source: BoundedEntitySource | undefined,
        linked: EntitySource | undefined,
        clause: WhereClause | undefined,
    ): Expression {
        return new LinkedEntity(
            source ?? this.source,
            linked ?? this.linked,
            clause ?? this.clause,
            this.set,
        );
    }

    *walk() {
        // TODO: Test this!
        yield this.source;
        yield this.linked;
        yield this.clause;
    }
}

export class SubSource extends Entity {
    readonly sub: Source;

    constructor(source: Source, identifier = randString()) {
        const entity = new EntityIdentifier(
            identifier,
            source.type as EntityType,
        );

        super(entity, source.fieldSet);
        this.sub = source;
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof SubSource === false) {
            return false;
        }
        // No complicated comparison.
        return this.identifier.isEqual(expression.identifier);
    }

    rebuild(sub: Source | undefined): SubSource {
        return new SubSource(
            sub ?? this.sub,
            this.identifier.name,
        );
    }

    /** A SubSource is not intended to be walked directly */
    *walk() { }
}

