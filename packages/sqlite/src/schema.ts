import { Database } from 'sqlite3';
import json from 'json5';

const IGNORE = [`sqlite_sequence`];

export type ColumnType = `TEXT` | `NUMERIC` | `INTEGER` | `REAL` | `BLOB`;
export type NullableColumnType = `${ColumnType} NULL`;

export type TableColumns = {
    [name: string]: ColumnType | NullableColumnType;
}

type TableLink = {
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
        return new Promise<Database>((resolve, reject) => {
            const result = new Database(file, (error) => {
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
        }).catch((error) => {
            console.error(`Error executing SQL`, error);
            throw error;
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
        return columns.reduce<Record<string, NullableColumnType>>((result, column: any) => {
            if (column.notnull) {
                result[column.name] = `${column.type} NULL` as NullableColumnType;
            } else {
                result[column.name] = column.type;
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
    const properties = Object.entries(schema.columns).map(([name, value]) => {
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


// select * from sqlite_schema

/*
type    name    tbl_name

table	Categories	Categories
table	sqlite_sequence	sqlite_sequence
table	CustomerCustomerDemo	CustomerCustomerDemo
index	sqlite_autoindex_CustomerCustomerDemo_1	CustomerCustomerDemo
table	CustomerDemographics	CustomerDemographics
index	sqlite_autoindex_CustomerDemographics_1	CustomerDemographics
table	Customers	Customers
index	sqlite_autoindex_Customers_1	Customers
table	Employees	Employees
table	EmployeeTerritories	EmployeeTerritories
index	sqlite_autoindex_EmployeeTerritories_1	EmployeeTerritories
table	Order Details	Order Details
index	sqlite_autoindex_Order Details_1	Order Details
table	Orders	Orders
table	Products	Products
table	Regions	Regions
table	Shippers	Shippers
table	Suppliers	Suppliers
table	Territories	Territories
index	sqlite_autoindex_Territories_1	Territories
view	Alphabetical list of products	Alphabetical list of products
view	Current Product List	Current Product List
view	Customer and Suppliers by City	Customer and Suppliers by City
view	Invoices	Invoices
view	Orders Qry	Orders Qry
view	Order Subtotals	Order Subtotals
view	Product Sales for 1997	Product Sales for 1997
view	Products Above Average Price	Products Above Average Price
view	Products by Category	Products by Category
view	Quarterly Orders	Quarterly Orders
view	Sales Totals by Amount	Sales Totals by Amount
view	Summary of Sales by Quarter	Summary of Sales by Quarter
view	Summary of Sales by Year	Summary of Sales by Year
view	Category Sales for 1997	Category Sales for 1997
view	Order Details Extended	Order Details Extended
view	Sales by Category	Sales by Category
view	ProductDetails_V	ProductDetails_V



SELECT * FROM pragma_table_info('Products');

cid name        type    notnull
0	ProductID	INTEGER	1		1
1	ProductName	TEXT	1		0
2	SupplierID	INTEGER	0		0
3	CategoryID	INTEGER	0		0
4	QuantityPerUnit	TEXT	0		0
5	UnitPrice	NUMERIC	0	0	0
6	UnitsInStock	INTEGER	0	0	0
7	UnitsOnOrder	INTEGER	0	0	0
8	ReorderLevel	INTEGER	0	0	0
9	Discontinued	TEXT	1	'0'	0



SELECT * FROM pragma_foreign_key_list('Products');

id  seq table (lnk) from (lnk)  to
0	0	Suppliers	SupplierID	SupplierID	NO ACTION	NO ACTION	NONE
1	0	Categories	CategoryID	CategoryID	NO ACTION	NO ACTION	NONE

*/