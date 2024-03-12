import { LogicalExpression } from './binary';
import { Column } from './column';
import { Expression } from './expression';
import { JoinExpression } from './join';
import { Columns, EntityType, Type } from './type';

export class SelectExpression extends Expression<`SelectExpression`> {
    expressionType = `SelectExpression` as const;
    type: Type;

    columns: Column[] | Column;
    source: Expression<string>;
    join: JoinExpression[];
    // TODO: This needs to store the links as well....
    where?: LogicalExpression;

    constructor(
        columns: Column[] | Column,
        source: Expression<string>,
        where?: LogicalExpression,
        join: JoinExpression[] = [],
    ) {
        super();
        this.columns = columns;
        this.source = source;
        this.join = join;
        this.where = where;

        if (Array.isArray(columns) === false) {
            this.type = columns.type;
            return;
        }

        const cols: Columns = columns.reduce(
            (result, column) => {
                result[column.name] = column.type;
                return result;
            },
            { } as Columns,
        );

        const type = new EntityType(cols);
        this.type = type;
    }
}
