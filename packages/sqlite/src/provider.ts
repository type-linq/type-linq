// import {
//     Prisma,

//     Categories,
//     CustomerCustomerDemo,
//     CustomerDemographics,
//     EmployeeTerritories,
//     Employees,
//     Order_Details,
//     Orders,
//     Products,
//     Regions,
//     Shippers,
//     Suppliers,
//     Territories
// } from '@prisma/client/edge'

import { Database } from 'sqlite3';
import { QueryProvider } from '../../core/src/query-provider';
import { Queryable } from '../../core/src/queryable';
import { Serializable } from '../../core/src/type';
import { prepare } from './compile';
import { DatabaseSchema } from './schema';

export class SqliteProvider extends QueryProvider {
    globals: Map<string[], string>;
    #dbFile: string;
    #db?: Database;
    #schema: DatabaseSchema;

    constructor(db: string, schema: DatabaseSchema, globals: Map<string[], string>) {
        super();
        this.globals = globals;
        this.#dbFile = db;
        this.#schema = schema;
    }

    async *execute<TResult>(source: Queryable<TResult>): AsyncGenerator<TResult> {
        const { sql, variables } = this.compile(source);
        const results = await this.run<TResult>(sql, variables);
        for (const result of results) {
            yield result;
        }
    }

    compile(source: Queryable<unknown>) {
        const { sql, variables } = prepare(source.expression, this.#schema, this.globals);
        return { sql, variables };
    }

    async run<TResult>(sql: string, variables: Serializable[]) {
        await this.#ensureDb();
        const rows = await this.#exec<TResult>(sql, variables);
        return rows;
    }

    #exec<TResult>(sql: string, variables: Serializable[]) {
        return new Promise<TResult[]>((resolve, reject) => {
            this.#db!.all(sql, variables, (error, rows) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(rows as TResult[]);
                }
            })
        });
    }

    async #ensureDb() {
        if (this.#db) {
            return;
        }

        console.log(this.#dbFile);

        this.#db = await new Promise((resolve, reject) => {
            const result = new Database(this.#dbFile, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    }
}

