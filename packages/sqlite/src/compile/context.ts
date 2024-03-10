import objectHash from 'object-hash';
import { JOIN, SELECT, WHERE } from '../../../core/src/constant';
import { Expression, ExpressionType, ExpressionTypeKey } from '../../../core/src/type';
import { SqlFragment, compile } from './sql';
import { walk } from '../../../core/src/walk';
import { readName } from './util';
import { DatabaseSchema } from '../schema';

export type ResultColumn = {
    source: Context;
    alias: string;
}

export type Context = {
    identifier: string;
    select?: ResultColumn[];
    where?: SqlFragment;
    join?: SqlFragment;
    source?: Context;
}

export function context(expression: Expression<ExpressionTypeKey>, schema: DatabaseSchema, globals: Map<string[], string>) {
    const globalsMap = new Map<string, string>;
    for (const [name, value] of globals) {
        globalsMap.set(objectHash(name), value);
    }
    return process(expression, schema, globalsMap);
}

function process(expression: Expression<ExpressionTypeKey>, schema: DatabaseSchema, globals: Map<string, string>, ctx?: Context): Context | undefined {
    switch (expression.type) {
        case `CallExpression`:
            return processCall(expression);
        case `Identifier`: {
            if (typeof expression.name === `symbol`) {
                throw new Error(`Unexpected symbol identifier`);
            }

            // TODO: What about globals?

            if (ctx) {
                throw new Error(`Unexpected context when arriving at root`);
            }

            const sourceContext = createContext(expression.name);
            const context = createContext(sourceContext);
            return context;
        }
        case `MemberExpression`: // TODO: Decompose, adding joins
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
            throw new Error(`"${expression.type}" not supported in SQLite`);
    }

    function processCall(expression: Expression<`CallExpression`>): Context {
        if (
            expression.callee.type !== `MemberExpression` ||
            expression.callee.property.type !== `Identifier` ||
            typeof expression.callee.property.name !== `symbol`
        ) {
            throw new Error(`Expected symbol call expression`);
        }

        ctx = process(expression.callee.object, schema, globals, ctx);

        switch (expression.callee.property.name) {
            case SELECT:
                return processSelect();
            case WHERE:
                return processWhere();
            case JOIN:
                return processJoin();
            default:
                throw new Error(`Unrecognized call symbol "${String(expression.callee.property.name)}" received`);
        }

        function processSelect() {
            if (!ctx) {
                throw new Error(`No context available for select`);
            }

            if (expression.arguments[0]?.type !== `ArrowFunctionExpression`) {
                throw new Error(`expected "ArrowFunctionExpression" as the first parameter ` +
                    `to the select call. Got "${expression.arguments[0]?.type}"`);
            }

            // TODO: We need a way to detect and required process joins....
            // TODO: Update this to use columns
            const sources = buildSources(expression.arguments[0], ctx!);
            const { sql: columns, variables: columnVariables } = compile(
                expression.arguments[0].body,
                sources,
                globals,
            );

            ctx.select = {
                sql: columns,
                variables: columnVariables,
            };

            // Select creates a new context
            return createContext(ctx);
        }

        function processWhere() {
            if (!ctx) {
                throw new Error(`No context available for where`);
            }

            if (expression.arguments[0]?.type !== `ArrowFunctionExpression`) {
                throw new Error(`expected "ArrowFunctionExpression" as the first parameter ` +
                    `to the select call. Got "${expression.arguments[0]?.type}"`);
            }

            const sources = buildSources(expression.arguments[0], ctx!);
            const fragment = compile(
                expression.arguments[0].body,
                sources,
                globals,
            );

            ctx.where = fragment;
            return ctx;
        }

        function processJoin() {
            if (!ctx) {
                throw new Error(`No context available for join`);
            }
            
            // We should have the following signature
            // outer.join(inner, outerKey, innerKey, result)
            expression.arguments.slice(0, expression.arguments.length - 1).forEach((
                expression: Expression<ExpressionTypeKey>, index: number) => {
                    if (expression.type !== `ArrowFunctionExpression`) {
                        throw new Error(`expected "ArrowFunctionExpression" as the parameter ` +
                            `at index ${index} to the join call. Got "${expression.type}"`);
                    }
                }
            );

            const innerLambda = (expression.arguments[0] as  Expression<`ArrowFunctionExpression`>);
            const outerKeyLambda = (expression.arguments[1] as  Expression<`ArrowFunctionExpression`>);
            const innerKeyLambda = (expression.arguments[2] as  Expression<`ArrowFunctionExpression`>);
            const resultLambda = (expression.arguments[3] as  Expression<`ArrowFunctionExpression`>);

            const innerBody = innerLambda.body;
            const outerKeyBody = outerKeyLambda.body;
            const innerKeyBody = innerKeyLambda.body;
            const resultBody = resultLambda.body;

            const innerContext = process(innerBody, globals);
            if (!innerContext) {
                throw new Error(`No context returned from join source`);
            }

            if (outerKeyBody.type !== innerKeyBody.type) {
                throw new Error(`Outer and inner functions do not return the same type`);
            }

            ctx.join = buildJoin();
            ctx.select = buildSelect();
            
            // Join creates a new context
            // TODO: This isn't quite right is it?
            //  What about multiple joins?
            //      Each one will use a cte like this!
            // The underlying issue is that we need the join to modify the column selection
            //  rather than replacing it?

            /*
            
            source1
                .join(source2, (c) => c.id, (c) => c.id, (s1, s2) => {
                    s1Id: s1.id,
                    s2Id: s2.id
                })
                .join(source3, (c) => c.s1Id, (c) => c.id, (s12, s3) => {
                    s1Id: s12.s1Id,
                    s2Id: s12.s2id,
                    s3Id: s3.id,
                })

            select source1.id as [s1Id], source2.id as [s2Id], source3.id as [s3Id]
            from source1
            join source2
                on source1.id = source2.id
            join source3
                on source1.id = source3.id                
            
            */

            return createContext(ctx);

            function buildJoin() {
                const joinExpressions = buildJoinExpressions();
                
                const sql = joinExpressions
                    .map(({ left, right }) => `${left.sql} = ${right.sql}`)
                    .join(`,\n\t`);

                return {
                    sql,
                    variables: joinExpressions.map(
                        ({ left, right }) => [...left.variables, ...right.variables]
                    ).flat()
                }
            }
            
            function buildJoinExpressions() {
                const joinExpressions: { left: SqlFragment, right: SqlFragment }[] = [];

                switch (outerKeyBody.type) {
                    case `ObjectExpression`: {
                        const outerProps = outerKeyBody.properties as Expression<`Property`>[];
                        const innerProps = (innerKeyBody as Expression<`ObjectExpression`>).properties as Expression<`Property`>[];

                        for (const outerProp of outerProps) {
                            const name = readName(outerProp.key);
                            const innerProp = innerProps.find((prop) => readName(prop) === name);
                            if (!innerProp) {
                                throw new Error(`Cannot find property named "${String(name)}" on the inner key result`);
                            }
                            const left = compile(outerProp.value, buildSources(outerKeyLambda, ctx!), globals);
                            const right = compile(innerProp.value, buildSources(innerKeyLambda, innerContext!), globals);
                            joinExpressions.push({ left, right });
                        }
                    }
                    break;
                    case `ArrayExpression`: {
                        const outerElements = outerKeyBody.elements as Expression<ExpressionTypeKey>[];
                        const innerElements = (innerKeyBody as Expression<`ArrayExpression`>).elements;

                        if (outerElements.length !== innerElements.length) {
                            throw new Error(`Outer key array length and inner key array length do not match`);
                        }

                        for (let index = 0; index < outerElements.length; index++) {
                            const outer = outerElements[index];
                            const inner = innerElements[index];
                            
                            const left = compile(outer, buildSources(outerKeyLambda, ctx!), globals);
                            const right = compile(inner, buildSources(innerKeyLambda, innerContext!), globals);
                            joinExpressions.push({ left, right });
                        }
                    }
                    break;
                    case `MemberExpression`:
                    case `Literal`: {
                        const left = compile(outerKeyBody, buildSources(outerKeyLambda, ctx!), globals);
                        const right = compile(innerKeyBody, buildSources(innerKeyLambda, innerContext!), globals);
                        joinExpressions.push({ left, right });
                    }
                    break;
                    default:
                        throw new Error(`Unsupported join key expression "${expression.type}"`);
                }

                return joinExpressions;
            }

            function buildSelect() {
                const sources = buildSources(resultLambda, ctx!, innerContext!);
                switch (resultBody.type) {
                    case `Identifier`:
                        // TODO: We may have something like (c) => c in which case we need to lookup the columns
                        // TODO: We need to implement our own mapping for this first
                        throw new Error(`not implemented`);
                    case `ObjectExpression`: {
                        const parts = resultBody.properties.map((property) => {
                            if (property.type !== `Property`) {
                                throw new Error(`Expected object property expressions to have type "Property". Got "${property.type}"`);
                            }

                            // If we have a selection, we need to use the aliases to lookup the properties
                            //  Othwrwise we need to use the map

                            const compiled = compile(
                                property.value,
                                sources,
                                globals,
                            );

                            return compiled;
                        });

                        const sql = parts.map((part) => part.sql).join(`\n\t`);
                        return {
                            sql,
                            variables: parts.map(({ variables }) => variables).flat(),
                        };
                    }
                    case `MemberExpression`: // TODO: Add implicit joins
                    case `Literal`: {
                        const compiled = compile(
                            resultBody,
                            sources,
                            globals,
                        );
                        return compiled;
                    }
                    default:
                        throw new Error(`Unsupported join result expression "${expression.type}"`);
                }
            }
        }

        function buildSources(expression: Expression<`ArrowFunctionExpression`>, ...contexts: Context[]) {
            const sources: Record<string | symbol, string> = {};
            for (let index = 0; index < contexts.length && index < expression.params.length; index++) {
                const context = contexts[index];
                sources[readName(expression.params[index])] = context.source!.identifier;
            }
            return sources;
        }
    }
}

function inferredJoins(expression: Expression<ExpressionTypeKey>) {
    // TODO: Find all member expressions pointing at source
    let accessExpressions: Expression<`MemberExpression`>[] = [];
    walk(expression, (exp) => {
        if (exp.type === `MemberExpression` && isRootSource(exp)) {
            accessExpressions.push(exp);
            return false;
        }
        return true;
    });

    const joins = [];

    for (const exp of accessExpressions) {
        let depth = memberDepth(exp);
        if (depth <= 2) {
            continue;
        }

        if (depth % 2 !== 0) {
            throw new Error(`Expected member depth to be even as it needs to be a repeating pattern of [<source>].[<property>]`);
        }

        // TODO: Imagine customer.Books.Publishers.Name
        // TODO: We first need to identify all the table

        let property: string;
        walk(exp, (exp) => {
            if (exp.type !== ExpressionType.MemberExpression) {
                throw new Error(`Expected expression to be a MemberExpression or an Identifier`);
            }

            if (exp.property.type !== ExpressionType.Identifier && exp.property.type !== ExpressionType.Literal) {
                throw new Error(`Expected MemberExpression property to be a Literal or an Identifier`);
            }

            if (depth <= 2) {
                return false;
            }
            depth--;

            if (depth % 2 === 1) {
                property = exp.property.type === `Identifier` ?
                    exp.property.name as string :
                    String(exp.property.value);
            } else {
                
            }
            
            return true;
        });
    }




    // Anything more than 2 is no longer direct source access
    accessExpressions = accessExpressions.filter(
        (exp) => memberDepth(exp) > 2,
    );

    // We only have direct access
    if (accessExpressions.length === 0) {
        return [];
    }

    for (const exp of accessExpressions) {
        let depth = memberDepth(exp);
        walk(exp, (exp) => {
            if (exp.type !== ExpressionType.MemberExpression && exp.type !== ExpressionType.Identifier) {
                throw new Error(`Expected expression to be a MemberExpression or an Identifier`);
            }

            if (depth <= 2) {
                return false;
            }
            depth--;


            
            return true;
        });
    }

    throw new Error(`not implemented`);
}

function isRootSource(expression: Expression<`Identifier` | `MemberExpression`>) {
    if (expression.type === ExpressionType.Identifier) {
        return expression.name === SOURCE;
    }

    if (expression.object.type !== ExpressionType.MemberExpression && expression.object.type !== ExpressionType.Identifier) {
        throw new Error(`Expected expression object to be a MemberExpression or an Identifier`);
    }

    return isRootSource(expression.object as Expression<ExpressionType.Identifier | ExpressionType.MemberExpression>);
}

function memberDepth(expression: Expression<`MemberExpression`>, depth = 0) {
    if (expression.object.type !== ExpressionType.MemberExpression && expression.object.type !== ExpressionType.Identifier) {
        throw new Error(`Expected expression object to be a MemberExpression or an Identifier`);
    }

    if (expression.object.type === `Identifier`) {
        return depth + 1;
    }

    return memberDepth(expression.object, depth + 1);
}

function rand() {
    return Math.random().toString(36).substring(2);
}

function createContext(source: Context | string): Context {
    if (typeof source === `string`) {
        return {
            identifier: source,
            select: undefined,
            where: undefined,
            source: undefined,
        };
    } else {
        return {
            // TODO: Would be nice to create a name based on the where and join clauses
            identifier: `${source.identifier}_${rand()}`,
            select: undefined,
            where: undefined,
            source: source,
        };
    }
}