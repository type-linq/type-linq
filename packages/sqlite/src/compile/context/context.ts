import { Expression, ExpressionType, ExpressionTypeKey } from '../../../../core/src/type';
import { walk } from '../../../../core/src/walk';
import { TableSchema } from '../../schema';
import { BooleanType, EntityType, NumberType, StringType, Type } from '../sql-type';
import { SourceEntityType } from '../type-tree';
import { randString, readName } from '../util';

// TODO: This should be in some constants file
const SCALER_NAME = `__SCALAR__65c26e71`;

export type ResultColumn = {
    expression: Expression<ExpressionTypeKey>;
    name: string;
    // TODO: Should this be a tree?
    implicitJoins: Record<string, string[]>;
    type: Type;
}

export type WhereClause = {
    expression: Expression<ExpressionTypeKey>;
    // TODO: Should this be a tree?
    implicitJoins: Record<string, string[]>;
}

export type JoinClause = {
    table: string;
    columns: { outer: string, inner: string }[];
}

// TODO: Should this be the "Type"
export type Source = {
    table: string;
}

export class Context {
    identifier: string;
    source?: Context;
    select: ResultColumn[];
    where: WhereClause[];
    join: JoinClause[];
    type: Type;

    #dirty = false;

    get dirty() {
        return this.#dirty;
    }

    constructor();
    constructor(source?: Context);
    constructor(source?: string, table?: TableSchema, type?: EntityType);
    constructor(source?: Context | string, table?: TableSchema, type?: EntityType) {
        if (typeof source === `string`) {
            this.identifier = source;
        } else if (source) {
            this.source = source;
            this.identifier = `${source.identifier}_${randString()}`;
        } else {
            throw new Error(`Either a root source name or a source Context must be supplied`);
        }

        this.where = [];
        this.join = [];

        if (typeof source !== `string`) {
            // We use the source context's result columns to generate the initial ones for this context
            this.select = source.select.slice();
            this.type = source.type;
            return;
        }

        // Now we deal with source contexts
        if (!table || !type) {
            throw new Error(`Table schema and EntityType need to be supplied for source contexts`);
        }

        // TODO: links? Not sue we should have those by default....
        //  The entity type will have them, so the member expressions should work

        const select = Object.keys(table.columns).map(
            (name) => ({
                expression: {
                    type: `MemberExpression`,
                    object: {
                        type: `Identifier`,
                        name: table.name,
                    },
                    property: {
                        type: `Identifier`,
                        name,
                    }
                },
                name,
                implicitJoins: {},
                type: type.accessors[name].type,
            } as ResultColumn)
        );
        this.type = type;
        this.select = select;
    }

    adjustSelect(expression: Expression<`ArrowFunctionExpression`>) {
        this.#dirty = true;
        const sourceName = readName(expression.params[0]);

        // TODO: We could have other things here...
        //  Imagine table.column + 10 ... or table.column > 20 ? table.otherColumn : 0

        switch (expression.body.type) {
            case ExpressionType.Literal:
                processLiteral.call(this, expression.body);
                break;
            case ExpressionType.CallExpression:
                processCallExpression.call(this, expression.body);
                break;
            case ExpressionType.ArrayExpression:
                processArrayExpression.call(this, expression.body);
                break;
            case ExpressionType.ObjectExpression:
                processObjectExpression.call(this, expression.body);
                break;
            case ExpressionType.Identifier:
                processIdentifier.call(this, expression.body);
                break;
            case ExpressionType.MemberExpression:
                processMemberExpression.call(this, expression.body);
                break;
            default:
                throw new Error(`Unsupported select expression type "${expression.body.type}"`);
        }

        function processLiteral(this: Context, expression: Expression<`Literal`>) {
            switch (typeof expression.value) {
                case `string`:
                    this.type = new StringType();
                    break;
                case `boolean`:
                    this.type = new BooleanType();
                    break;
                case `number`:
                    this.type = new NumberType();
                    break;
                default:
                    throw new Error(`Unexpected literal value type ${typeof expression.value} received`);
            }

            this.select = [{
                expression,
                implicitJoins: {},
                name: SCALER_NAME,
                type: this.type,
            }];
        }

        function processIdentifier(this: Context, exp: Expression<`Identifier`>) {
            // The only time we get an identifier directly is when we have something like
            //  c => c. In which case we don't need to do anything
        }

        function processCallExpression(this: Context, exp: Expression<`CallExpression`>) {
            throw new Error(`not implemented`);
        }

        function processArrayExpression(this: Context, exp: Expression<`ArrayExpression`>) {
            throw new Error(`not implemented`);
        }

        function processObjectExpression(this: Context, exp: Expression<`ObjectExpression`>) {
            throw new Error(`not implemented`);
        }

        function processMemberExpression(this: Context, exp: Expression<`MemberExpression`>) {
            // TODO: This needs to walk the type tree...
            //  

            const type = walk.call(this, exp);
            const implicitJoins: Record<string, string[]> = {};

            // TODO: Don't we need the implicit joins on existing columns?

            if (type instanceof EntityType === false) {
                const expression: Expression<`MemberExpression`> = {
                    object: {
                        type: `Identifier`,
                        name: ``,
                    },
                    property: {
                        type: `Identifier`,
                        name: ``,
                    }
                };

                // Scalar
                const column: ResultColumn = {
                    expression: undefined,
                    implicitJoins,
                    name: SCALER_NAME,
                    type,
                };

                this.type = type;
                this.select = [column];
                return;
            }

            // TODO: Implicit joins!

            // TODO: Now we could have a scalar or an entity
            //  If we have an entity we need the selects to use that table...
            //  If we have a scalar

            // We could have
            //  [Foo].[bar]
            //  [Foo].[linked]
            //  [Foo].[linked].[baz]

            // But foo could be pointing at something that is not a base source..?
            /*
                c.[bar] as [baz]
                -> [Foo].[bar] as [baz]

                ===

                c.[baz].length as [hello]
                -> [Foo].[bar].length as [hello]

                ===

                c.[hello] + 10 as [world]
                -> [Foo].[bar].length + 10 as [world]

            */

            // A linked enity is ALWAYS a source entity!!!!
            //  The issue is an entity type doesn't have a concept of which
            //      table is it's source... so we get the entity type... 
            //      but we don't know which table to link on....
            //      We need to store the entity type source....

            // SourceEntityType

            // Every time we encounter a source entity type, we need to replace the expression
            //  with the table name...


            function walk(this: Context, exp: Expression<ExpressionTypeKey>) {
                switch (exp.type) {
                    case `Identifier`: {
                        // TODO: Globals
                        if (exp.name !== sourceName) {
                            throw new Error(`Unknown identifier "${String(exp.name)}" received`);
                        }
                        return this.type;
                    }
                    case `MemberExpression`: {
                        const type = walk.call(this, exp.object) as Type;
                        const name = readName(exp.property) as string;

                        if (type.accessors[name] === undefined) {
                            throw new Error(`Unable to find property "${name}" on type`);
                        }

                        const result = type.accessors[name].type;

                        if (result instanceof SourceEntityType) {
                            const source = sourceEntity(type);
                            if (source !== undefined) {
                                implicitJoins[source.schema.name] = implicitJoins[source.schema.name] ?? [];
                                implicitJoins[source.schema.name].push(result.schema.name);
                            }
                        }

                        return result;
                    }
                    default:
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        throw new Error(`Unexpected expression type "${(exp as any).type}"`);
                }
            }



            if (exp.object.type === `Identifier` && exp.object.name === sourceName) {
                const propName = readName(exp.property);
                if (typeof propName === `symbol`) {
                    throw new Error(`Unexpected symbol identifier "${String(propName)}" received`);
                }

                

                // TODO: Linked?!

                // TODO: What do we want to do when a linked expression comes up?
                // TODO: Surely this logic needs to be common to where and select?
                /*
                    (c) => { baz: c.linked.bar }

                    select [Linked].[bar] as [baz]
                    from [Foo]
                    join [Linked]
                        on [Foo].[linkedId] = [Linked].[linkedId]

                    [Linked].[bar]
                    implicit: { Foo: [Linked] }
                */

                // TODO: We need to walk the type tree...
                // TODO: Think it would make it a lot easier to have a reference to the table schema
                //  on the entity type...

                const existingIndex = this.select.findIndex(
                    (column) => column.name === propName
                );

                if (existingIndex === -1) {
                    throw new Error(`Unable to find column named "${propName}" in the existing select list`);
                }

                const existing = this.select[existingIndex];
                this.select.splice(existingIndex, 1, {
                    ...existing,
                    name: propName,
                });
            }

            throw new Error(`not implemented`);
        }
    }

    addWhere(clause: WhereClause) {
        this.#dirty = true;
        this.where.push(clause);
    }

    addJoin(clause: JoinClause) {
        this.#dirty = true;
        this.join.push(clause);
    }
}

function sourceEntity(entity: EntityType) {
    if (entity instanceof SourceEntityType) {
        return entity;
    } else if (entity.source) {
        return sourceEntity(entity.source);
    } else {
        return undefined;
    }
}