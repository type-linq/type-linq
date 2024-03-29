import sqlite3 from 'sqlite3';
import json from 'json5';

const IGNORE = [`sqlite_sequence`];

export type ColumnType = `TEXT` | `NUMERIC` | `INTEGER` | `REAL` | `BLOB`;
export type NullableColumnType = `${ColumnType} NULL`;

export type TableColumns = {
    [name: string]: {
        name: string;
        type: ColumnType | NullableColumnType;
    };
}

export type TableLink = {
    table: string;
    columns: {
        [name: string]: string;
    }
};

export type TableLinks = {
    [name: string]: TableLink;
}

export type TableSchema<TTableColumns extends TableColumns = TableColumns> = {
    name: string;
    columns: TTableColumns;
    links: TableLinks;
}

export type DatabaseSchema<TTableColumns extends TableColumns = TableColumns> = {
    tables: {
        [name: string]: TableSchema<TTableColumns>;
    }
}

// TODO: Add functions to adjust names
export async function fetchSchema(file: string) {
    const db = await createDb();
    const tableNames = await tables();
    const items = await Promise.all(
        tableNames.map(
            (name) => processTable(name)
        )
    );

    return items.reduce<DatabaseSchema>((result, item) => {
        result.tables[item.name] = item;
        return result;
    }, { tables: {} });

    async function processTable(name: string): Promise<TableSchema<TableColumns>> {
        const columns = await tableInfo(name);
        const links = await tableLinks(name);

        return {
            name,
            columns,
            links,
        }
    }

    function createDb() {
        return new Promise<sqlite3.Database>((resolve, reject) => {
            const result = new sqlite3.Database(file, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    }

    function exec(sql: string) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new Promise<any[]>((resolve, reject) => {
            db!.all(sql, [], (error, rows) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(rows);
                }
            })
        });
    }


    async function tables() {
        const rows = await exec(`select * from sqlite_schema where type = 'table'`);
        return rows
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((row: any) => row.name)
            .filter((name) => IGNORE.includes(name) === false);
    }

    async function tableInfo(name: string) {
        const columns = await exec(`select * from pragma_table_info('${name}')`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return columns.reduce<Record<string, { name: string, type: NullableColumnType }>>((result, column: any) => {
            if (column.notnull) {
                result[column.name] = {
                    name: column.name,
                    type: `${column.type} NULL` as NullableColumnType,
                };
            } else {
                result[column.name] = {
                    name: column.name,
                    type: column.type,
                };
            }
            return result;
        }, {});
    }

    async function tableLinks(name: string) {
        const links = await exec(`select * from pragma_foreign_key_list('${name}')`);

        const grouped = links.reduce<Record<string, TableLink>>((result, link) => {
            result[link.id] = result[link.id] || {
                table: link.table,
                columns: {},
            };
            result[link.id].columns[link.to] = link.from;
            return result;
        }, {});

        return Object.values(grouped).reduce<Record<string, TableLink>>((result, link) => {
            let count = 0;
            let name = link.table;
            while (result[name]) {
                count++;
                name = `${link.table}_${count}`;
            }

            result[name] = {
                table: link.table,
                columns: link.columns,
            }
            return result;
        }, {});
    }
}

export function buildSchemaFile(schema: DatabaseSchema) {
    // TODO: This is missing build sources...
    const full = [
        `import { DatabaseSchema } from '@type-linq/sqlite';`,
        ``,
        buildSchema(schema, `DatbaseSchema`),
        ``,
        buildTypes(schema),
    ].join(`\n`);
    return full;
}

export function buildSchema(schema: DatabaseSchema, type?: string) {
    const str = json.stringify(schema, {
        quote: '`',
        space: 4,
    });

    type = type ?
        `: ${type}` :
        ``;

    return `export const schema${type} = ${str};`;
}

export function buildTypes(schema: DatabaseSchema) {
    const types = Object.values(schema.tables).reduce<string[]>((result, value) => {
        result.push(buildType(value));
        return result;
    }, []);
    return types.join(`\n\n`);
}

// TODO: Add functions to map names
// TODO: Add functions to map types
export function buildType(schema: TableSchema<TableColumns>) {
    const properties = Object.entries(schema.columns).map(([name, { type: value }]) => {
        const nullable = value.split(` `).pop() === `NULL`;
        const typeName = typescriptTypeName(value);
        return `${name}${nullable ? `?` : ``}: ${typeName};`;
    });

    const links = Object.entries(schema.links).map(([name, value]) => {
        return `${encodeName(name)}: ${encodeName(value.table)};`;
    });

    const fields = [...properties];

    if (links.length) {
        fields.push(``),
        fields.push(...links);
    }

    // TODO: This encoding won't work... we won't be able to lookup the correct values in the schema!
    // TODO: We will need to check against the encoded name when looking up tables in 
    return `export type ${encodeName(schema.name)} = {\n${fields.map((c) => `    ${c}`).join(`\n`)}\n}`;

    function typescriptTypeName(dbType: string) {
        switch (dbType) {
            case `TEXT`:
            case `TEXT NULL`:
            case `DATE`:
            case `DATE NULL`:
            case `DATETIME`:
            case `DATETIME NULL`:
                // TODO: Consider how we could do date better?
                //  We need some kind of forced conversion on the result I think
                return `string`;
            case `NUMERIC`:
            case `NUMERIC NULL`:
            case `INTEGER`:
            case `INTEGER NULL`:
            case `REAL`:
            case `REAL NULL`:
                return `number`;
            case `BLOB`:
            case `BLOB NULL`:
                return `unknown`;
            default:
                throw new Error(`Unknown db type "${dbType}" received`);
        }
    }

    function encodeName(name: string) {
        return name.replace(/[^A-Za-z0-9$_]/gi, `_`);
    }
}
