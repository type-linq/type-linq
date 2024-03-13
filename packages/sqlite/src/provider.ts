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
import { Queryable } from '../../core/src/queryable/queryable';
import { Serializable } from '../../core/src/type';
import { DatabaseSchema } from './schema';
import { Globals } from '../../core/src/convert/global';
import { Type } from '../../core/src/tree/type';
import { Expression, ExpressionType } from '../../core/src/tree/expression';
import { GlobalExpression } from '../../core/src/tree/global';
import { CallExpression } from '../../core/src/tree/call';

export class SqliteProvider extends QueryProvider {
    globals: Globals;
    #globalIdentifiers: unknown;

    #dbFile: string;
    #db?: Database;
    #schema: DatabaseSchema;

    constructor(db: string, schema: DatabaseSchema, globals?: unknown) {
        super();

        this.#globalIdentifiers = globals;
        this.globals = {
            mapAccessor: this.#mapAccessor,
            mapIdentifier: this.#mapIdentifier,
        };

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

    #mapIdentifier = (...path: string[]): GlobalExpression | undefined => {
        throw new Error(`not implemented`);
    }

    #mapAccessor = (type: Type, object: Expression<ExpressionType>, name: string | symbol, args: Expression<ExpressionType>[]): GlobalExpression | CallExpression | undefined => {
        throw new Error(`not implemented`);
    }
}

