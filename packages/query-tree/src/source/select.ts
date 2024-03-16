import { Expression } from '../expression';
import { Alias, FieldIdentifier } from '../identifier';
import { JoinExpression } from './join';
import { Field, SourceExpression } from './source';

export class SelectExpression extends SourceExpression<`SelectExpression`> {
    expressionType = `SelectExpression` as const;
    fields: Field[] | Field;

    get source() {
        return super.source!;
    }

    constructor(
        source: SourceExpression,
        fields: Field[] | Field,
    ) {
        super(source);
        this.fields = fields;
    }

    applyFieldJoins(): SelectExpression {
        const implicitJoins: JoinExpression[] = [];

        const fields = Array.isArray(this.fields) ?
            this.fields.map(processField) :
            processField(this.fields);

        const adjusted = Expression.walkMutate(this, (exp) => {
            if (exp === this) {
                return (exp as SelectExpression).source;
            }
            if (exp instanceof JoinExpression) {
                const from = Expression.source(exp);
                const joins = implicitJoins.filter(
                    (join) => Expression.source(join.source).isEqual(from)
                );

                if (joins.length === 0) {
                    return exp;
                }

                let current = exp;
                for (const join of joins) {
                    current = new JoinExpression(
                        current,
                        join.joined,
                        join.join,
                    );
                }
                return current;
            }
            return exp;
        });

        return new SelectExpression(
            adjusted as SourceExpression,
            fields,
        );

        function processField(field: Field) {
            if (field instanceof FieldIdentifier === true) {
                return field;
            }

            const exp = Expression.walkMutate(field.expression, (exp) => {
                if (exp instanceof JoinExpression) {
                    implicitJoins.push(exp);
                    return exp.source;
                }
                return exp;
            });

            return exp as Alias<Expression>;
        }
    }
}
