import { Column } from './column';
import { Expression } from './expression';
import { Columns, EntityType, Type } from './type';

export class SourceExpression extends Expression<`SourceExpression`> {
    expressionType = `SourceExpression` as const;
    type: Type;

    resource: string;
    name: string;
    columns: Column[] | Column;

    constructor(resource: string, columns: Column[] | Column, name?: string) {
        super();

        this.resource = resource;
        this.name = name ?? resource;
        this.columns = columns;

        if (Array.isArray(columns)) {
            const cols: Columns = columns.reduce(
                (result, column) => {
                    result[column.name] = column.type;
                    return result;
                },
                { } as Columns,
            );
    
            const type = new EntityType(cols);
            this.type = type;
        } else {
            this.type = columns.type;
        }

        
    }
}
