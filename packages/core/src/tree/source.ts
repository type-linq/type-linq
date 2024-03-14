import { Column } from './column';
import { Expression } from './expression';
import { Identifier } from './identifier';
import { JoinClause, JoinExpression } from './join';
import { Columns, EntityType, Type } from './type';

type Link = {
    outerName: string;
    outerType: Type;
    innerName: string;
    innerType: Type;
}

export class SourceExpression extends Expression<`SourceExpression`> {
    expressionType = `SourceExpression` as const;
    type: Type;

    resource: string;
    name: string;
    columns: Column[] | Column;
    #links: Map<SourceExpression, Link[]>;

    constructor(resource: string, columns: Column[] | Column, name?: string) {
        super();

        this.resource = resource;
        this.name = name ?? resource;
        this.columns = columns;
        this.#links = new Map<SourceExpression, Link[]>();

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

    addColumns(columns: Column[]) {
        // TODO: What happens with a scalar column
        const et = this.type as EntityType<Columns>;
        for (const col of columns) {
            et.columns[col.name] = col.type;
        }

        if (Array.isArray(this.columns)) {
            this.columns.push(...columns);
        } else {
            this.columns = [this.columns, ...columns];
        }
    }

    link(source: SourceExpression, columns: Link[]) {
        if (this.#links.has(source)) {
            this.#links.delete(source);
        }
        this.#links.set(source, columns);
    }

    join(inner: SourceExpression): JoinExpression {
        const outer = this;
        // TODO: The link needs to have the type as well.....
        const link = this.#links.get(inner);
        if (!link) {
            throw new Error(`Source is not linked. Call SourceExpression.link with the desired linking sources`);
        }

        const clauses: JoinClause[] = [];
        for (const { outerName, outerType, innerName, innerType } of link) {
            const left = new Identifier(
                outerName,
                outerType,
                outer.name,
            );

            const right = new Identifier(
                innerName,
                innerType,
                inner.name,
            );

            const clause = new JoinClause(left, right);
            clauses.push(clause);
        }

        return new JoinExpression(inner, clauses);
    }
}
