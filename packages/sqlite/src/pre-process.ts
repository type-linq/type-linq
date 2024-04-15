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

    const explodeEntity = (field: Field) => {
        if (field.expression instanceof EntitySource === false) {
            return field;
        }

        return field.expression.fieldSet.scalars().fields.map(
            (scalarField) => processExplodedField(field.name.name, scalarField)
        );
    }

    const fields = source.fieldSet.fields.map(explodeEntity).flat();

    // Now swap out the base of the branch
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