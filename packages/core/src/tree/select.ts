import { BinaryExpression, LogicalExpression } from './binary';
import { Column } from './column';
import { Expression } from './expression';
import { JoinExpression } from './join';
import { SourceExpression } from './source';
import { Columns, EntityType, Type } from './type';
import { asArray, joinExists } from './util';

export class SelectExpression extends Expression<`SelectExpression`> {
    expressionType = `SelectExpression` as const;
    type: Type;

    columns: Column[] | Column;
    source: SourceExpression | SelectExpression;
    join: JoinExpression[];
    where?: LogicalExpression | BinaryExpression;

    constructor(
        columns: Column[] | Column,
        source: SourceExpression | SelectExpression,
        where?: LogicalExpression | BinaryExpression,
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

    applyImplicitJoins(): SelectExpression {
        // TODO: How much of this can be moved to the join handler?
        const joins: JoinExpression[] = [
            ...this.join,
        ];
        for (const column of asArray(this.columns)) {
            const columnJoins = buildImplicitJoins(
                joins,
                column.linkMap,
            );
            joins.push(...columnJoins);
        }
        return new SelectExpression(
            this.columns,
            this.source,
            this.where,
            joins,
        );
    }
}

export function buildImplicitJoins(
    existing: JoinExpression[],
    linkMap: Map<SourceExpression, SourceExpression[]>
): JoinExpression[] {
    const joins: JoinExpression[] = [...existing];
    for (const [joinFrom, joinTos] of linkMap.entries()) {
        for (const joinTo of joinTos) {
            // TODO: Maybe move this function as a global export instead of on the join expression?
            const join = joinFrom.join(joinTo);

            if (joinExists(joins, join)) {
                continue;
            }

            joins.push(join);
        }
    }
    return joins;
}