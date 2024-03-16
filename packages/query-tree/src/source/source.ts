import { Alias, FieldIdentifier } from '../identifier';
import { Expression, SourceExpressionType } from '../expression';
import { EntityType, Fields, Type } from '../type';
import { JoinExpression } from './join';
import { SelectExpression } from './select';
import { readName } from '../util';


export type Field = Alias<Expression> | FieldIdentifier;

export abstract class SourceExpression<TType extends SourceExpressionType = SourceExpressionType> extends Expression<TType> {
    abstract fields: Field[] | Field;

    #source?: SourceExpression;
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

    scalar(name: string, type: Type) {
        if (Array.isArray(this.fields) === false) {
            throw new Error(`Cannot add fields to a scalar source`);
        }

        const field = new FieldIdentifier(this, name);
        this.fields.push(field);
    }

    finalize(forceSelect = true, forceScalars = false): SourceExpression {
        let select: SelectExpression | undefined = undefined;
        const expression = Expression.walkBranchMutate(this, (exp) => {
            if (exp instanceof JoinExpression) {
                return new JoinExpression(
                    exp.source,
                    exp.joined.finalize(false, forceScalars),
                    exp.join,
                );
            }

            if (exp instanceof SelectExpression) {
                select = exp;
                return select.source;
            }

            return exp;
        });

        if (expression instanceof SelectExpression === false && forceSelect === false) {
            return expression;
        }

        if (select === undefined && forceSelect) {
            select = new SelectExpression(
                expression,
                expression.fields,
            );
        } else if (select) {
            select = new SelectExpression(
                expression,
                (select as SelectExpression).fields,
            );
        }

        if (select === undefined) {
            return expression;
        }

        const result = select.applyFieldJoins();
        return result;
    }
}
