import { SqliteProvider } from './src/provider';
import { SqliteQueryableSource } from './src/queryable';
import { buildSources } from './src/sources';
import { DatabaseSchema } from './src/schema';

// TODO: Generate these types automatically

type Product = {
    ProductID: number;
    ProductName: string;
    SupplierID?: number;
    CategoryID?: number;
    QuantityPerUnit?: string;
    UnitPrice?: number;
    UnitsInStock?: number;
    UnitsOnOrder?: number;
    ReorderLevel?: number;
    Discontinued: string;

    Supplier: Supplier;
}

type Supplier = {
    SupplierID: number;
    CompanyName: string;
    ContactName?: string;
    ContactTitle?: string;
    Address?: string;
    City?: string;
    Region?: string;
    PostalCode?: string;
    Country?: string;
    Phone?: string;
    Fax?: string;
    HomePage?: string;

    Products: Product[];
}

const schema: DatabaseSchema = {
    tables: {
        Products: {
            name: `Products`,
            columns: {
                ProductID: `INTEGER`,
                ProductName: `TEXT`,
                SupplierID: `INTEGER NULL`,
                CategoryID: `INTEGER NULL`,
                QuantityPerUnit: `TEXT NULL`,
                UnitPrice: `NUMERIC NULL`,
                UnitsInStock: `INTEGER NULL`,
                UnitsOnOrder: `INTEGER NULL`,
                ReorderLevel: `INTEGER NULL`,
                Discontinued: `TEXT`,
            },
            primaryKey: [`ProductID`],
            links: {
                Supplier: {
                    table: `Suppliers`,
                    columns: {
                        SupplierID: `SuppliedID`,
                    }
                }
            }
        },
        Suppliers: {
            name: `Suppliers`,
            columns: {
                SupplierID: `INTEGER`,
                CompanyName: `TEXT`,
                ContactName: `TEXT NULL`,
                ContactTitle: `TEXT NULL`,
                Address: `TEXT NULL`,
                City: `TEXT NULL`,
                Region: `TEXT NULL`,
                PostalCode: `TEXT NULL`,
                Country: `TEXT NULL`,
                Phone: `TEXT NULL`,
                Fax: `TEXT NULL`,
                HomePage: `TEXT NULL`,
            },

            primaryKey: [`SupplierID`],
            links: {
                Product: {
                    table: `Products`,
                    columns: {
                        SupplierID: `SupplierID`,
                    }
                }
            }
        }
    },
} as const;

const provider = new SqliteProvider(`D:\\Projects\\type-linq\\packages\\sqlite\\resources\\northwind.db`, schema, new Map());

/*
type Schema = typeof schema;

type SqlTypeMap = {
    TEXT: string,
    INTEGER: number,
    NUMERIC: number,
};

type Split<S extends string, D extends string> =
    string extends S ? string[] :
    S extends '' ? [] :
    S extends `${infer T}${D}${infer U}` ? [T, ...Split<U, D>] : [S];

type ColumnType<T extends string> =
    T extends `${string} NULL`
    ? ColumnType<Split<T, ` `>[0]>
    : T extends keyof SqlTypeMap
    ? SqlTypeMap[T]
    : never;

type RequiredSchema<T extends { [name: string]: string }> = {
    -readonly [
        Column in keyof T as
            T[Column] extends `${string} NULL`
            ? never
            : Column
    ]-?: T[Column] extends `${string} NULL`
        ? never
        : ColumnType<T[Column]>
}

type OptionalSchema<T extends { [name: string]: string }> = {
    -readonly [
        Column in keyof T as
            T[Column] extends `${string} NULL`
            ? Column
            : never
    ]?: T[Column] extends `${string} NULL`
        ? ColumnType<T[Column]> | null
        : never
}

type LinkSchema = {
    schema: string;
    table: string;
    columns: Record<string, string>;
}

type LinksSchema = {
    // TODO: Should this be optional if the columns for the link are all nullable?
    -readonly [K in keyof ProductLinksSchema]: ProductLinksSchema[K][`table`] extends keyof Schema[`tables`][ProductLinksSchema[K][`schema`]]
    ? EntitySchema<Schema[`tables`][ProductLinksSchema[K][`schema`]][ProductLinksSchema[K][`table`]][`columns`]> //Schema[`tables`][ProductLinksSchema[K][`schema`]][ProductLinksSchema[K][`table`]]
    : never;
}

type EntitySchema<T extends { [name: string]: string }> = RequiredSchema<T> & OptionalSchema<T>;

type Debug<T> = {
    [K in keyof T]: T[K];
}

// type ProductsColumnSchema = Schema[`tables`][`Products`][`columns`];
type ProductsBase = Debug<EntitySchema<Schema[`tables`][`northwind`][`Products`][`columns`]>>;
type SuppliersBase = Debug<EntitySchema<Schema[`tables`][`northwind`][`Suppliers`][`columns`]>>;

type ProductLinksSchema = typeof schema[`tables`][`northwind`][`Products`][`links`];

type ProductsLinks = {
    // TODO: Should this be optional if the columns for the link are all nullable?
    -readonly [K in keyof ProductLinksSchema]: ProductLinksSchema[K][`table`] extends keyof Schema[`tables`][ProductLinksSchema[K][`schema`]]
    ? EntitySchema<Schema[`tables`][ProductLinksSchema[K][`schema`]][ProductLinksSchema[K][`table`]][`columns`]> //Schema[`tables`][ProductLinksSchema[K][`schema`]][ProductLinksSchema[K][`table`]]
    : never;
}

type Products = ProductsBase & ProductsLinks;

const p: Products = undefined!;

type Test = Debug<Products>;*/

const sources = buildSources(schema);

class ProductsQueryable extends SqliteQueryableSource<Product> {
    constructor() {
        super(provider, sources.Products)
    }
}

(async function run() {
    const products = new ProductsQueryable();

    const productId = 57;
    const recordLevel = 10;
    const arg = `M`;

    const query1 = products;

    const query2 = products
        .select((c) => ({
            productId: c.ProductID,
            name: c.ProductName
        }))
        .where((c) => c.name > arg, { arg })

    for await (const product of query2) {
        console.dir(product);
    }

    console.log(`Done`);
}());

// SqliteQueryableSource