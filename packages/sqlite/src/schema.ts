export type ColumnType = `TEXT` | `NUMERIC` | `INTEGER` | `REAL` | `BLOB`;
export type NullableColumnType = `${ColumnType} NULL`;

export type TableColumns = {
    [name: string]: ColumnType | NullableColumnType;
}

export type TableLinks = {
    [name: string]: {
        table: string;
        columns: {
            [name: string]: string;
        }
    }
}

export type TableSchema<TTableColumns extends TableColumns = TableColumns> = {
    name: string;
    columns: TTableColumns;
    primaryKey: (keyof TTableColumns)[];
    links: TableLinks;
}

export type DatabaseSchema<TTableColumns extends TableColumns = TableColumns> = {
    tables: {
        [name: string]: TableSchema<TTableColumns>;
    }
}
