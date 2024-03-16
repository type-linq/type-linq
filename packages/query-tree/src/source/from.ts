import { Field, SourceExpression } from '../source/source';
import { EntityIdentifier, FieldIdentifier, Alias } from '../identifier';
import { readName } from '../util';
import { Expression } from '../expression';
import { JoinExpression, JoinClause } from './join';
import { EntityType, Fields, Type } from '../type';

export type LinkField = {
    sourceName: string;
    joinedName: string;
}


export class FromExpression extends SourceExpression<`FromExpression`> {
    expressionType = `FromExpression` as const;

    fields: Field | Field[];
    entity: EntityIdentifier;

    #type?: Type;

    get type() {
        if (this.#type) {
            return this.#type;
        }

        if (Array.isArray(this.fields) === false) {
            return this.fields.type;
        }

        const cols: Fields = this.fields.reduce(
            (result, field) => {
                const name = readName(field);
                result[name] = field.type;
                return result;
            },
            { } as Fields,
        );

        const type = new EntityType(cols);
        // TODO: Think about possible implications of caching here
        //  We do want to return the same type of nothing has changed,
        //  however caching may lead to some strange and enexpected edge
        //  case that is difficult to debug
        this.#type = type;
        return type;
    }

    constructor(entity: EntityIdentifier, columns: Field | Field[]) {
        super();
        this.entity = entity;
        this.fields = columns;
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

        const linkedFrom = Expression.source(linkedSource);
        const thisFrom = Expression.source(this);

        const clauses = link.map(
            ({ sourceName, joinedName }) => {
                return new JoinClause(
                    new FieldIdentifier(thisFrom, sourceName),
                    new FieldIdentifier(linkedFrom, joinedName),
                );
            }
        )

        const field = new Alias(
            new JoinExpression(
                this,
                linkedSource,
                clauses,
            ),
            name,
        );

        this.fields.push(field);
        this.#type = undefined;
    }
}

