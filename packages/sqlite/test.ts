import { SqliteProvider } from './src/provider.js';
import { SqliteQueryableSource } from './src/queryable.js';
import { buildSources } from './src/sources.js';
import { DatabaseSchema, buildSchemaFile, fetchSchema } from './src/schema.js';

const DB = `D:\\Projects\\type-linq\\packages\\sqlite\\resources\\northwind.db`;

(async function () {
    // const schema = await fetchSchema(DB);
    // console.log(buildSchemaFile(schema));
}());

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
                ProductID: { name: `ProductID`, type: `INTEGER` },
                ProductName: { name: `ProductName`, type: `TEXT` },
                SupplierID: { name: `SupplierID`, type: `INTEGER NULL` },
                CategoryID: { name: `CategoryID`, type: `INTEGER NULL` },
                QuantityPerUnit: { name: `QuantityPerUnit`, type: `TEXT NULL` },
                UnitPrice: { name: `UnitPrice`, type: `NUMERIC NULL` },
                UnitsInStock: { name: `UnitsInStock`, type: `INTEGER NULL` },
                UnitsOnOrder: { name: `UnitsOnOrder`, type: `INTEGER NULL` },
                ReorderLevel: { name: `ReorderLevel`, type: `INTEGER NULL` },
                Discontinued: { name: `Discontinued`, type: `TEXT` },
            },
            links: {
                Supplier: {
                    table: `Suppliers`,
                    columns: {
                        SupplierID: `SupplierID`,
                    }
                }
            }
        },
        Suppliers: {
            name: `Suppliers`,
            columns: {
                SupplierID: { name: `SupplierID`, type: `INTEGER` },
                CompanyName: { name: `CompanyName`, type: `TEXT` },
                ContactName: { name: `ContactName`, type: `TEXT NULL` },
                ContactTitle: { name: `ContactTitle`, type: `TEXT NULL` },
                Address: { name: `Address`, type: `TEXT NULL` },
                City: { name: `City`, type: `TEXT NULL` },
                Region: { name: `Region`, type: `TEXT NULL` },
                PostalCode: { name: `PostalCode`, type: `TEXT NULL` },
                Country: { name: `Country`, type: `TEXT NULL` },
                Phone: { name: `Phone`, type: `TEXT NULL` },
                Fax: { name: `Fax`, type: `TEXT NULL` },
                HomePage: { name: `HomePage`, type: `TEXT NULL` },
            },

            links: {
                Products: {
                    table: `Products`,
                    columns: {
                        SupplierID: `SupplierID`,
                    }
                }
            }
        }
    },
} as const;

const provider = new SqliteProvider(DB, schema);

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

class SuppliersQueryable extends SqliteQueryableSource<Supplier> {
    constructor() {
        super(provider, sources.Suppliers)
    }
}

(async function run() {
    const products = new ProductsQueryable();
    const suppliers = new SuppliersQueryable();

    const productId = 57;
    const recordLevel = 10;
    const arg = `M`;

    // const query1 = products;

    // // TODO: Why is the column in the where clause not fully qualified?
    // //  There must be somewhere we are not adding scope to the identifier...?

    // const query2 = products
    //     .select((c) => ({
    //         productId: c.ProductID,
    //         name: c.ProductName,
    //         supplier: c.Supplier.CompanyName,
    //     }))
    //     // .select((c) => ({
    //     //     productId: c.productId,
    //     //     name: c.name,
    //     //     supplier: c.supplier,
    //     // }))
    //     .where((c) => c.supplier > arg, { arg })
    //     .join(
    //         suppliers,
    //         (c) => c.supplier,
    //         (c) => c.CompanyName,
    //         (outer, inner) => ({
    //             productId: outer.productId,
    //             name: outer.name,
    //             supplier: outer.supplier,
    //             supplierId: inner.SupplierID,
    //         })
    //     )

    // const query3 = suppliers
    //     .where((c) => c.CompanyName.length > 10);

    // const query4 = products
    //     .where((c) => c.Supplier.CompanyName.length > 10);

    // const query5 = suppliers
    //     .select((c) => c.CompanyName.trim())

    // TODO: Sort out ??

    // TODO: Dodgy SQL
    // const query6 = products
    //     .select((c) => ({
    //         name: c.ProductName,
    //         stock: c.UnitsInStock!.toExponential(),
    //         time: Date.now(),
    //     }));

    // const query7 = products
    //     .select((c) => ({
    //         name: c.ProductName,
    //         stock: Math.max(c.UnitsInStock!, 10),
    //     }))

    // const query7 = products
    //     .join(
    //         suppliers
    //             .where((c) => c.CompanyName > `B`),
    //             // TODO: Try without select expression....
    //             // .select((c) => c),
    //         (c) => c.SupplierID,
    //         (c) => c.SupplierID,
    //         (o, i) => ({
    //             id: o.ProductID, 
    //             name: o.ProductName,
    //             supplier: i.CompanyName,
    //         })
    //     )

    // const query8 = products
    //     .select((c) => ({
    //         productId: c.ProductID,
    //         name: c.ProductName,
    //         supplier: c.Supplier,
    //     }))
    //     .orderBy((c) => c.name)
    //     .thenBy((c) => c.supplier.CompanyName);

    // const query9 = suppliers
    //     .select((c) => c.Region)
    //     .distinct();

    // const query10 = products
    //     .groupBy((c) => c.Supplier.Region!)
    //     .select((c) => ({
    //         region: c.Supplier.Region,
    //         stock: Math.max(c.UnitsInStock!)
    //     }))
    //     .orderByDescending((c) => c.stock);


    // const query11 = products
    //     .where((c) => c.UnitsInStock! > 10)
    //     .groupBy(
    //         (c) => c.Supplier.Region!,
    //         (c) => c.UnitsInStock!,
    //         (key, product) => ({
    //             region: key,
    //             stock: Math.max(product),
    //         })
    //     )
    //     .where((c) => c.stock > 100)
    //     .orderByDescending((c) => c.stock);

    // const query12 = products
    //     .skip(3)
    //     .take(2);

    // const query13 = products
    //     .where((c) => c.UnitsInStock! > 10)
    //     .groupBy(
    //         (c) => c.Supplier.Region!,
    //         (c) => c.UnitsInStock!,
    //         (key, product) => ({
    //             region: key,
    //             stock: Math.max(product),
    //         })
    //     )
    //     // .where((c) => c.stock > 100)
    //     .skip(2)
    //     .orderByDescending((c) => c.stock);

    const query14 = products
        .where((c) => c.ProductName === 'foo')
        .defaultIfEmpty({
            foo: `bar`,
        } as unknown as Product);



    for await (const product of query14) {
        console.dir(product);
    }

    console.log(`Done`);
    
}());

// SqliteQueryableSource