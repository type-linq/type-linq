import sqlite3 from 'sqlite3';
import {
    QueryProvider,
    Queryable,
    Serializable,
    Globals,
} from '@type-linq/core';
import {
    Type,
    Expression,
    ExpressionType,
    GlobalIdentifier,
    CallExpression,
    Janitor,
} from '@type-linq/query-tree';
import { compile } from './compile.js';
import { DatabaseSchema } from './schema.js';

export class SqliteProvider extends QueryProvider {
    globals: Globals;
    #globalIdentifiers: unknown;

    #dbFile: string;
    #db?: sqlite3.Database;
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
        const expression = Janitor.finalize(source.expression, true, true);
        const { sql, variables } = this.compile(expression);

        console.log(`Executing SQL`);
        console.log(sql);
        console.log(variables);
        console.log(`=======================================`);

        const results = await this.run<TResult>(sql, variables);
        for (const result of results) {
            yield result;
        }
    }

    compile(expression: Expression<ExpressionType>) {
        const { sql, variables } = compile(expression);
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
            const result = new sqlite3.Database(this.#dbFile, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    }

    #mapIdentifier = (...path: string[]): GlobalIdentifier | undefined => {
        console.log(`mapIdentifier`, path);
        // throw new Error(`not implemented`);
        return undefined;
    }

    #mapAccessor = (type: Type, object: Expression<ExpressionType>, name: string | symbol, args: Expression<ExpressionType>[]): GlobalIdentifier | CallExpression | undefined => {
        console.log(`mapAccessor`, type, object, name, args);
        return undefined;
    }
}

