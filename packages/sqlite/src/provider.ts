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
    Source,
    StringType,
    NumberType,
    BooleanType,
    DateType,
    FunctionType,
    BinaryType,
    UnknownType,
    EntityType,
    UnionType,
    GlobalIdentifier,
    CallExpression,
    CallArguments,
} from '@type-linq/query-tree';
import { compile } from './compile.js';
import { DatabaseSchema } from './schema.js';
import { identifier as stringIdentifier, accessor as stringAccessor } from './global/string.js';
import { identifier as mathIdentifier } from './global/math.js';
import { identifier as numberIdentifier, accessor as numberAccessor } from './global/number.js';
import { accessor as booleanAccessor } from './global/boolean.js';
import { accessor as dateAccessor, identifier as dateIdentifier } from './global/date.js';
import { log } from './log.js';
import { postProcess, unflatten } from './post-process.js';
import { preProcess } from './pre-process.js';

export class SqliteProvider extends QueryProvider {
    globals: Globals;

    #dbFile: string;
    #db?: sqlite3.Database;
    #schema: DatabaseSchema;

    get schema() {
        return this.#schema;
    }

    constructor(db: string, schema: DatabaseSchema) {
        super();

        this.globals = {
            mapAccessor: this.#mapAccessor,
            mapIdentifier: this.#mapIdentifier,
            mapHandler: this.#mapHandler,
            hasIdentifier: this.#hasIdentifier,
        };

        this.#dbFile = db;
        this.#schema = schema;
    }

    async *execute<TResult>(source: Queryable<TResult>): AsyncGenerator<TResult> {
        const finalized = this.finalize(source.expression);
        const expression = preProcess(finalized);

        const { sql, variables, setTransforms, itemTransforms } = this.compile(expression);

        log.debug(`Executing SQL`);
        log.debug(sql.replaceAll(`\t`, `    `));
        log.debug(variables);
        log.debug(`=======================================`);

        let results = await this.run<TResult>(sql, variables);
        log.debug(`Got ${results.length} results`);
        log.debug(`=======================================`);

        const convert = postProcess(expression);

        for (const transform of setTransforms) {
            results = transform(results) as TResult[];
        }

        results = results.map(
            (result) => {
                let current = convert(result);
                for (const transform of itemTransforms) {
                    current = transform(current);
                }
                return current;
            }
        );

        for (const item of results) {
            yield item as TResult;
        }
    }

    compile(expression: Source) {
        const { sql, variables, setTransforms, itemTransforms } = compile(expression);
        return { sql, variables, setTransforms, itemTransforms };
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

    #hasIdentifier = (path: string): boolean => {
        switch (path) {
            case `Math`:
            case `Number`:
            case `String`:
            case `Date`:
            case `parseInt`:
            case `parseFloat`:
                return true;
            default:
                return false;
        }
    }

    #mapHandler = (handler: string, args?: Expression[]): Expression | undefined => {
        switch (handler) {
            case `sum`:
                return new CallExpression(
                    new NumberType(),
                    new GlobalIdentifier(
                        `sum`,
                        new FunctionType(new NumberType())
                    ),
                    new CallArguments(args ?? []),
                );
            default:
                return undefined;
        }
    }

    #mapIdentifier = (path: string[], args?: Expression[]): Expression | undefined => {
        if (path.length === 0) {
            throw new Error(`Received empty path`);
        }

        switch (path[0]) {
            case `Math`:
                return mathIdentifier(path.slice(1), args);
            case `Number`:
                return numberIdentifier(path.slice(1), args);
            case `parseInt`:
            case `parseFloat`:
                if (path.length > 1) {
                    return undefined;
                }
                return numberIdentifier([path[0]], args);
            case `String`:
                return stringIdentifier(path.slice(1), args);
            case `Date`:
                return dateIdentifier(path.slice(1));
            default:
                return undefined;
        }
    }

    #mapAccessor = (type: Type, object: Expression, name: string | symbol, args: Expression[]): Expression | undefined => {
        switch (true) {
            case type instanceof StringType:
                return stringAccessor(object, name, args);
            case type instanceof NumberType:
                return numberAccessor(object, name, args);
            case type instanceof BooleanType:
                return booleanAccessor(object, name, args);
            case type instanceof DateType:
                return dateAccessor(object, name, args);
            case type instanceof UnionType:
                // TODO
                // What kinds of accessors work on union type...
                //  maybe toString?
                // It would be a bit tough since something like toString
                //  returns a different expression for Date....
                //  We could check that all expressions match?
                //      And if an expression doesn't exist?
                //          ignore it?
                throw new Error(`not implemented`);
            case type instanceof FunctionType:
            case type instanceof BinaryType:
            case type instanceof UnknownType:
            case type instanceof EntityType:
                return undefined;
            default:
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                throw new Error(`Unknown type "${(type as any).constructor.name}" received`);
        }
    }
}

