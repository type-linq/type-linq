import objectHash from 'object-hash';
import { SELECT, SOURCE, WHERE } from '../../../core/src/constant';
import { Expression, ExpressionType, ExpressionTypeKey } from '../../../core/src/type';
import { SqlFragment, compile } from './sql';
import { walk } from '../../../core/src/walk';

export type Context = {
    identifier: string;
    select?: SqlFragment;
    where?: SqlFragment;
    source?: Context;
}

export function context(expression: Expression<ExpressionTypeKey>, globals: Map<string[], string>) {

    // TODO: Before we compile we need to analyze functions for
    //  required joins, and flatten member expressions....

    const globalsMap = new Map<string, string>;
    for (const [name, value] of globals) {
        globalsMap.set(objectHash(name), value);
    }
    return process(expression, globalsMap);
}

function process(expression: Expression<ExpressionTypeKey>, globals: Map<string, string>, ctx?: Context): Context | undefined {
    switch (expression.type) {
        case `CallExpression`:
            return processCall(expression);
        case `Identifier`: {
            if (typeof expression.name === `symbol`) {
                throw new Error(`Unexpected symbol identifier`);
            }

            if (ctx) {
                throw new Error(`Unexpected context when arriving at root`);
            }

            const sourceContext = createContext(expression.name);
            const context = createContext(sourceContext);
            return context;
        }
        case `MemberExpression`:
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

        ctx = process(expression.callee.object, globals, ctx);

        switch (expression.callee.property.name) {
            case SELECT:
                return processSelect();
            case WHERE:
                return processWhere();
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

            const { sql: columns, variables: columnVariables } = compile(
                expression.arguments[0].body,
                ctx.source!.identifier,
                globals
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
                throw new Error(`No context available for select`);
            }

            if (expression.arguments[0]?.type !== `ArrowFunctionExpression`) {
                throw new Error(`expected "ArrowFunctionExpression" as the first parameter ` +
                    `to the select call. Got "${expression.arguments[0]?.type}"`);
            }

            const fragment = compile(
                expression.arguments[0].body,
                ctx.source!.identifier,
                globals,
            );

            ctx.where = fragment;
            return ctx;
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