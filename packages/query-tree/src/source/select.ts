import { Expression } from '../expression.js';
import { EntityIdentifier } from '../identifier.js';
import { Boundary, FieldSet } from './field.js';
import { Source } from './source.js';

export class SelectExpression extends Source {
    fieldSet: FieldSet;
    entity: EntityIdentifier | Boundary<EntityIdentifier>;

    constructor(entity: EntityIdentifier | Boundary<EntityIdentifier>, fieldSet: FieldSet) {
        super();
        this.entity = entity;
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

    rebuild(entity: EntityIdentifier | Boundary<EntityIdentifier> | undefined, fieldSet: FieldSet | undefined): SelectExpression {
        return new SelectExpression(
            entity ?? this.entity,
            fieldSet ?? this.fieldSet,
        );
    }

    *walk() {
        yield this.entity;
        yield this.fieldSet;
    }
}
