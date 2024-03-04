import { Products } from '@prisma/client';
import { SqliteProvider } from './src/provider';
import { SqliteQueryableSource } from './src/queryable';

const provider = new SqliteProvider(`D:\\Projects\\type-linq\\packages\\sqlite\\resources\\northwind.db`, new Map());

class ProductsQueryable extends SqliteQueryableSource<Products> {
    constructor() {
        super(provider, `Products`)
    }
}

(async function run() {
    const products = new ProductsQueryable();

    const productId = 57;
    const recordLevel = 10;

    const query1 = products;

    const query2 = products
        .select((c) => ({
            productId: c.ProductID,
            name: c.ProductName
        }))

    for await (const product of query2) {
        console.dir(product);
    }

    console.log(`Done`);
}());

// SqliteQueryableSource