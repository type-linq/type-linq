import { Field, SourceExpression } from '../source/source.js';
import { EntityIdentifier, FieldIdentifier } from '../identifier.js';
import { readName } from '../util.js';
import { JoinClause, JoinExpression } from './join.js';
import { Walker } from '../walker.js';

export type LinkField = {
    sourceName: string;
    joinedName: string;
}


export class FromExpression extends SourceExpression<`FromExpression`> {
    expressionType = `FromExpression` as const;

    fields: Field | Field[];
    entity: EntityIdentifier;

    get type() {
        return super.type;
        // return this.entity.type;
    }

    constructor(entity: EntityIdentifier, fields: Field | Field[] = []) {
        super();
        this.entity = entity;
        this.fields = fields;
    }

    scalar(name: string) {
        if (Array.isArray(this.fields) === false) {
            throw new Error(`Cannot add fields to a scalar source`);
        }

        const field = new FieldIdentifier(this, name);
        this.fields.push(field);
        this.clearTypeCache();
    }

    link(name: string, linkedSource: SourceExpression, link: LinkField[]) {
        if (Array.isArray(this.fields) === false) {
            throw new Error(`Cannot link an entity on a scalar source`);
        }

        const existing = this.fields.find(
            (column) => readName(column) === name,
        );

        if (existing) {
            throw new Error(`A column named "${name}" already exists on the source`);
        }

        const linkedFrom = Walker.source(linkedSource);
        const thisFrom = Walker.source(this);

        const clauses = link.map(
            ({ sourceName, joinedName }) => {
                return new JoinClause(
                    new FieldIdentifier(thisFrom, sourceName),
                    new FieldIdentifier(linkedFrom, joinedName),
                );
            }
        );

        const field = new FieldIdentifier(
            linkedSource,
            name,
            linkedSource.type,
            [
                new JoinExpression(
                    this,
                    linkedSource,
                    clauses,
                )
            ]
        );

        this.fields.push(field);
        this.clearTypeCache();
    }
}

