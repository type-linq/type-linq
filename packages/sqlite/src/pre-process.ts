import { EntitySource, Field, FieldSet, SelectExpression, Source, Walker } from '@type-linq/query-tree';

export function preProcess(source: Source) {
    // There are 2 distinct cases we need to handle...
    //  1. We have selected an entity source directly, in which case we should generate a select
    //     expression using only it's scalars....
    //  2. We have an EntityType in one of the columns, in which case we must get all scalar fields
    //     and merge them into the existing fields (with "<Name>"."<Scalar Name>")
    const processExplodedField = (parent: string, field: Field) => {
        return new Field(
            field.expression,
            `${parent}.${field.name.name}`,
        );
    }

    const explodeEntity = (field: Field, parent?: string) => {
        if (field.expression instanceof Source === false) {
            return field;
        }

        const parentName = parent ?
            `${parent}.${field.name.name}` :
            field.name.name;

        if (field.expression instanceof EntitySource) {
            return field.expression.fieldSet.scalars().fields.map(
                (scalarField) => processExplodedField(parentName, scalarField)
            );
        }

        return field.expression.fieldSet.fields.map(
            (subField): Field | Field[] => {
                if (subField.expression instanceof Source) {
                    return explodeEntity(subField, parentName);
                } else if ((field.expression as Source).fieldSet.scalar) {
                    return explodeEntity(
                        new Field(
                            subField.expression,
                            field.name.name,
                        ),
                        parent,
                    );
                } else {
                    return processExplodedField(parentName, subField);
                }
            }
        ).flat();
    }

    const fields = source.fieldSet.fields
        .map((field) => explodeEntity(field))
        .flat();
    
    const finalResult = Walker.mapSource(source, (exp) => {
        if (exp instanceof SelectExpression === false) {
            return exp;
        }

        const result = new SelectExpression(
            exp.fieldSet.scalar && fields.length === 1 ?
                new FieldSet(fields[0]) :
                new FieldSet(fields),
            exp.distinct,
        );
        return result;
    });

    return finalResult;
}