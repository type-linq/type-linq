import { Expression, ExpressionTypeKey, expressionKeys } from '../../../../core/src/type';
import { DatabaseSchema, TableColumns, TableSchema } from '../../schema';
import { isSymbolCallExpression, memberExpressionRoot, readName } from '../util';
import { Context, Prepared } from './type';

type TypedMemberExpressionSource<TType extends `table` | `column`> = {
    type: TType;
    table: TType extends `table` ?
        TableSchema<TableColumns> :
        undefined;
    column: TType extends `column` ?
        Expression<`Identifier`> :
        undefined;
}

type TypedMemberExpression<TType extends `table` | `column` = `table` | `column`> = {
    type?: TypedMemberExpressionSource<TType>;
    expression: Expression<ExpressionTypeKey>;
}

/**
 * Flattens any member expressions to their table.name combination
 * Maps globals
 * Replaces sources with their table names
 */
export function prepare(
    expression: Expression<ExpressionTypeKey>,
    schema: DatabaseSchema,
    sources: Record<string, Context>,
    global: (
        expression: Expression<`Identifier` | `MemberExpression` | `CallExpression`>
    ) => Expression<ExpressionTypeKey> | undefined
): Prepared {
    const implicitJoins: Record<string, string[]> = {};
    expression = process(expression);

    // TODO: Dedpup implicit joins
    // TODO: Implicit joins should be a tree surely?

    return {
        expression,
        implicitJoins
    };

    function process(expression: Expression<ExpressionTypeKey>): Expression<ExpressionTypeKey> {
        switch (expression.type) {
            case `CallExpression`: {
                if (isSymbolCallExpression(expression)) {
                    throw new Error(`Unexpected symbol call expression`);
                }

                const args = expression.arguments.map(process);
                const result = {
                    type: `CallExpression`,
                    arguments: args,
                    callee: expression.callee,
                } as Expression<`CallExpression`>;

                const globalExpression = global(result);
                if (globalExpression !== undefined) {
                    return globalExpression;
                }

                return {
                    ...result,
                    callee: process(result.callee),
                } as Expression<`CallExpression`>;
            }
            case `Identifier`: {
                if (typeof expression.name === `symbol`) {
                    throw new Error(`Unexpected symbol identifier`);
                }

                const globalExpression = global(expression);
                if (globalExpression !== undefined) {
                    return globalExpression;
                }

                const source = sources[expression.name];

                // TODO: If we add the imolicit columns at the start,
                //  Then all code paths are the same....

                // We should never arrive here if we have a select on the context
                //  That should be handled by the member expressions
                // TODO: What about c => c
                if (source.select) {
                    throw new Error(
                        `Only expected to process identifier when no select has been ` +
                            `applied to the source`
                    );
                }

                // TODO: We need to integrate result columns from the select somehow...
                //  If we assume the result column has the correct table name structure
                //  in the expression already, it should be simple?

                // Basically... we need to use the schema table name when there are no result columns, but the
                //  columns when they are available.

                

                
                if (source === undefined) {
                    throw new Error(`No source found for identifier "${expression.name}"`);
                }

                const table = schema.tables[source.identifier];
                if (table === undefined) {                    
                    throw new Error(`Table "${source.identifier}" not found on schema`);
                }

                // TODO: When we have an identifier we could have something like

                // (c: RootTable) => { bar: c.foo };
                // (c: Derived) => { baz: c.bar };

                // In case 1 we will replace c with the table name.
                // In case 2 we will replace c.bar with the value
                //      of the result column "bar" on the Derived type C

                if (source.select) {
                    // const column = source.select.column()
                } else {
                    return {
                        type: `Identifier`,
                        name: schema.tables[source.identifier].name,
                    } as Expression<`Identifier`>;
                }
    
                if (schema.tables[source] === undefined) {                    
                    throw new Error(`Table "${source}" not found on schema`);
                }
    
                return {
                    type: `Identifier`,
                    name: schema.tables[source].name,
                } as Expression<`Identifier`>;
            }
            case `MemberExpression`:
                return processMemberExpression(expression);
            case `ArrowFunctionExpression`:
            case `BinaryExpression`:
            case `Literal`:
            case `ArrayPattern`:
            case `ArrayExpression`:
            case `AssignmentExpression`:
            case `AssignmentPattern`:
            case `AwaitExpression`:
            case `BlockStatement`:
            case `BreakStatement`:
            case `CatchClause`:
            case `ChainExpression`:
            case `ClassBody`:
            case `ClassDeclaration`:
            case `ClassExpression`:
            case `ConditionalExpression`:
            case `ContinueStatement`:
            case `DebuggerStatement`:
            case `DoWhileStatement`:
            case `EmptyStatement`:
            case `ExperimentalRestProperty`:
            case `ExperimentalSpreadProperty`:
            case `ExportAllDeclaration`:
            case `ExportDefaultDeclaration`:
            case `ExportNamedDeclaration`:
            case `ExportSpecifier`:
            case `ExpressionStatement`:
            case `ForInStatement`:
            case `ForOfStatement`:
            case `ForStatement`:
            case `FunctionDeclaration`:
            case `FunctionExpression`:
            case `IfStatement`:
            case `ImportDeclaration`:
            case `ImportDefaultSpecifier`:
            case `ImportExpression`:
            case `ImportNamespaceSpecifier`:
            case `ImportSpecifier`:
            case `LabeledStatement`:
            case `LogicalExpression`:
            case `MetaProperty`:
            case `MethodDefinition`:
            case `NewExpression`:
            case `ObjectExpression`:
            case `ObjectPattern`:
            case `PrivateIdentifier`:
            case `Program`:
            case `Property`:
            case `PropertyDefinition`:
            case `RestElement`:
            case `ReturnStatement`:
            case `SequenceExpression`:
            case `SpreadElement`:
            case `StaticBlock`:
            case `Super`:
            case `SwitchCase`:
            case `SwitchStatement`:
            case `TaggedTemplateExpression`:
            case `TemplateElement`:
            case `TemplateLiteral`:
            case `ThisExpression`:
            case `ThrowStatement`:
            case `TryStatement`:
            case `UnaryExpression`:
            case `UpdateExpression`:
            case `VariableDeclaration`:
            case `VariableDeclarator`:
            case `WhileStatement`:
            case `WithStatement`:
            case `YieldExpression`:
            default: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const exp = { ...expression } as any;
                const keys = expressionKeys[expression.type];
                for (const key of keys) {
                    if (Array.isArray(exp[key])) {
                        exp[key] = exp[key].map(process);
                    } else {
                        exp[key] = process(exp[key]);
                    }
                }
                return exp;
            }
        }
    }

    function processMemberExpression(expression: Expression<`MemberExpression`>) {
        const root = memberExpressionRoot(expression);
        if (root.type !== `Identifier` || sources[root.name as string] === undefined) {
            return {
                type: `MemberExpression`,
                object: process(expression.object),
                property: process(expression.property),
            } as Expression<`MemberExpression`>;
        }
        const { expression: result } = processExpression(expression);
        return result;

        function processExpression(expression: Expression<`MemberExpression` | `Identifier`>): TypedMemberExpression {
            if (expression.type === `Identifier`) {
                // TODO: We need to integrate result columns from the select somehow...
                //  If we assume the result column has the correct table name structure
                //  in the expression already, it should be simple?

                // Basically... we need to use the schema table name when there are no result columns, but the
                //  columns when they are available.

                // Lookup type on schema
                const tableName = sources[expression.name as string];
                if (!schema.tables[tableName]) {
                    throw new Error(`Unable to find table "${tableName}" on schema (From identifier "${String(expression.name)}")`);
                }
                return {
                    type: {
                        type: `table`,
                        table: schema.tables[tableName],
                        column: undefined,
                    },
                    expression: {
                        type: `Identifier`,
                        name: tableName,
                    } as Expression<`Identifier`>
                };
            }

            const name = readName(expression.property) as string;
            const { type, expression: objectExpression } = processExpression(expression.object as Expression<`MemberExpression` | `Identifier`>);

            if (!type) {
                throw new Error(`Unable to read property "${name}"`);
            }

            if (type.type === `column`) {
                const exp = {
                    type: `CallExpression`,
                    arguments: [objectExpression],
                    callee: type.column,
                } as Expression<`CallExpression`>;

                const globalExpression = global(exp);
                if (globalExpression !== undefined) {
                    return { type: undefined, expression: globalExpression };
                }

                throw new Error(`Unable to resolve "${name}"`);
            }

            const tableLink = type.table!.links[name];
            if (tableLink !== undefined) {
                implicitJoins[type.table!.name] = implicitJoins[type.table!.name] || [];
                implicitJoins[type.table!.name].push(tableLink.table);
                
                if (!schema.tables[tableLink.table]) {
                    throw new Error(`Unable to find linked table "${tableLink.table}" on schema (Defined on table "${type.table!.name}")`);
                }

                return {
                    type: {
                        type: `table`,
                        table: schema.tables[tableLink.table],
                        column: undefined,
                    },
                    expression: {
                        type: `Identifier`,
                        name: tableLink.table,
                    } as Expression<`Identifier`>
                };
            }

            const tableColumn = type.table!.columns[name];
            if (tableColumn === undefined) {
                throw new Error(`Unable to find column named "${name}" on table "${type.table!.name}"`);
            }

            const column = tableColumn.split(` `).shift();
            let typeIdentifier: Expression<`Identifier`> | undefined;
            
            switch (column) {
                case `TEXT`:
                    typeIdentifier = { type: `Identifier`, name: `String` };
                    break;
                case `NUMERIC`:
                case `INTEGER`:
                case `REAL`:
                    typeIdentifier = { type: `Identifier`, name: `Number` };
                    break;
                case `BLOB`:
                default:
                    typeIdentifier = undefined;
                    break;
            }
            
            return {
                type: typeIdentifier && {
                    type: `column`,
                    table: undefined,
                    column: typeIdentifier,
                },
                expression: {
                    type: `MemberExpression`,
                    object: objectExpression,
                    property: expression.property,
                } as Expression<`MemberExpression`>
            };
        }
    }
}
