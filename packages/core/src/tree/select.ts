import { BinaryExpression, LogicalExpression } from './binary';
import { Column } from './column';
import { Expression, ExpressionType } from './expression';
import { JoinExpression } from './join';
import { SourceExpression } from './source';
import { Columns, EntityType, Type } from './type';
import { asArray } from './util';

// TODO: In some sense this must extend a source?
//  How can we tell primary key from

// TODO: It would be better to change this to have the other expressons applied on top of it...
//  This would allieviate a lot of the issues we seem to be having with sources....

//  It would be good to have a common expression type
//      for master functions (like where join, select etc)
//      and there should be a walkable path which can give use all source expressions
//      used for joining

export class SelectExpression extends Expression<`SelectExpression`> {
    expressionType = `SelectExpression` as const;
    type: Type;

    columns: Column[] | Column;
    source: Expression<ExpressionType>;
    join: JoinExpression[];
    where?: LogicalExpression | BinaryExpression;

    constructor(
        columns: Column[] | Column,
        source: Expression<ExpressionType>,
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

export function joinExists(joins: JoinExpression[], join: JoinExpression) {
    for (const existing of joins) {
        if (join.isEqual(existing)) {
            return true;
        }
    }
    return false;
}

export function buildImplicitJoins(
    existing: JoinExpression[],
    linkMap: Map<SourceExpression, SourceExpression[]>
): JoinExpression[] {
    const joins: JoinExpression[] = [...existing];
    for (const [joinFrom, joinTos] of linkMap.entries()) {
        for (const joinTo of joinTos) {
            const join = joinFrom.join(joinTo);

            if (joinExists(joins, join)) {
                continue;
            }

            joins.push(join);
        }
    }
    return joins;
}