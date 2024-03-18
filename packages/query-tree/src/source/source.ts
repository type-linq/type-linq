import { Alias, FieldIdentifier } from '../identifier.js';
import { Expression, SourceExpressionType } from '../expression.js';
import { EntityType, Fields, Type } from '../type.js';
import { readName } from '../util.js';

export type Field = FieldIdentifier | Alias<Expression>;

export abstract class SourceExpression<TType extends SourceExpressionType = SourceExpressionType> extends Expression<TType> {
    abstract fields: Field[] | Field;

    #source?: SourceExpression;
    #type?: Type;

    get type(): Type {
        // TODO: The only time we need to get this type like this

        // TODO: This is causing circular ref issues...
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

    get fieldsArray() {
        if (Array.isArray(this.fields)) {
            return this.fields;
        } else {
            return [this.fields];
        }
    }

    get source() {
        return this.#source;
    }

    constructor(source?: SourceExpression) {
        super();
        this.#source = source;
    }

    field(name: string) {
        return this.fieldsArray.find(
            (field) => readName(field) === name
        );
    }

    protected clearTypeCache() {
        this.#type = undefined;
    }
}
