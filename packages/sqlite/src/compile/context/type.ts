// TODO: Deprecated

import { Expression, ExpressionTypeKey } from '../../../../core/src/type';

export type Prepared = {
    expression: Expression<ExpressionTypeKey>;
    implicitJoins: Record<string, string[]>;
}

export type ResultColumn = {
    expression: Expression<ExpressionTypeKey>;
    name: string;
    implicitJoins: Record<string, string[]>;
};

export type Join = {
    inner: Context;
    outerKey: Expression<ExpressionTypeKey>[];
    innerKey: Expression<ExpressionTypeKey>[];
};

export type Context = {
    identifier: string;
    select?: ResultSet;
    where?: Expression<ExpressionTypeKey>[];
    join?: Join[];
    source?: Context;
}

export class ResultSet {
    #columns?: ResultColumn[];

    get hasColumns() {
        return Boolean(this.#columns);
    }

    get names() {
        return this.columns().map(
            (column) => column.name,
        )
    }

    column(name: string) {
        return this.columns().find(
            (column) => column.name === name
        );
    }

    columns(defaultColumns: ResultColumn[] = []) {
        return this.#columns ?? defaultColumns;
    }
}
