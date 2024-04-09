import { Expression } from '../expression.js';
import { FieldIdentifier } from '../identifier.js';
import { Walker } from '../walk.js';
import { Boundary, EntitySource, LinkedEntity } from './entity.js';
import { FieldSet } from './field.js';
import { Source } from './source.js';

export class SelectExpression extends Source {
    fieldSet: FieldSet;

    get source() {
        return undefined;
    }

    constructor(fieldSet: FieldSet) {
        super();
        this.fieldSet = fieldSet;
    }

    isEqual(expression?: Expression): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof SelectExpression === false) {
            return false;
        }

        if (this.fieldSet.isEqual(expression.fieldSet) === false) {
            return false;
        }

        return true;
    }

    rebuild(fieldSet: FieldSet): SelectExpression {
        return new SelectExpression(fieldSet);
    }

    *walk() {
        yield this.fieldSet;
    }

    entities() {
        const entities: EntitySource[] = [];
        Walker.walk((this.fieldSet), (exp) => {
            if (exp instanceof FieldIdentifier === false) {
                return;
            }
            entities.push(exp.entity);
        });
        return entities;
    }

    root() {
        const fieldIdentifiers = Walker.collect(
            this.fieldSet,
            (exp) => exp instanceof FieldIdentifier
        ) as FieldIdentifier[];

        let multiple = false;
        let current: EntitySource | undefined = undefined;
        let depth = Infinity;

        for (const identifier of fieldIdentifiers) {
            if (identifier.entity instanceof EntitySource === false) {
                continue;
            }

            const eDepth = entityDepth(identifier.entity);

            if (current === undefined) {
                current = identifier.entity;
                depth = eDepth;
                continue;
            }

            if (current.isEqual(identifier.entity)) {
                continue;
            }

            if (eDepth === depth) {
                multiple = true;
                continue;
            }

            if (eDepth < depth) {
                depth = eDepth;
                current = identifier.entity;
            }
        }

        if (multiple) {
            throw new Error(`Multiple root sources found`);
        }

        return current!;

        function entityDepth(entity: EntitySource): number {
            if (entity instanceof LinkedEntity) {
                return entityDepth(entity.source);
            }

            if (entity instanceof Boundary) {
                return entityDepth(entity.source) + 1;
            }

            return 0;
        }
    }
}
