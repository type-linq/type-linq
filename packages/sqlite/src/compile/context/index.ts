import { JOIN, SELECT, WHERE } from '../../../../core/src/constant';
import { Expression, ExpressionTypeKey } from '../../../../core/src/type';
import { DatabaseSchema } from '../../schema';
import { isSymbolCallExpression, randString, readName } from '../util';
import { prepare } from './prepare';
import { Context, ResultColumn, ResultSet } from './type';



export function context(
    expression: Expression<ExpressionTypeKey>,
    // TODO: Is this required anymore?
    schema: DatabaseSchema,

    // TODO: This probably needs reworking....
    global: (expression: Expression<`Identifier` | `MemberExpression` | `CallExpression`>
) => Expression<ExpressionTypeKey> | undefined) {
    return process(expression);

    function process(expression: Expression<ExpressionTypeKey>, ctx?: Context) {
        if (!isSymbolCallExpression(expression)) {
            throw new Error(`Expected a symbol call expression`);
        }
        const cexp = expression as Expression<`CallExpression`>;
        if (cexp.callee.type !== `MemberExpression`) {
            throw new Error(`Expected callee to be a MemberExpression`);
        }
    
        const name = readName(cexp.callee.property);
        switch (name) {
            case SELECT:
                return processSelect(cexp);
            case WHERE:
                return processWhere();
            case JOIN:
                return processJoin();
            default:
                throw new Error(`Unrecognized call symbol "${String(name)}" received`);
        }
    
        function processSelect(expression: Expression<`CallExpression`>) {
            if (!ctx) {
                throw new Error(`No context available for select`);
            }
    
            if (expression.arguments[0]?.type !== `ArrowFunctionExpression`) {
                throw new Error(`expected "ArrowFunctionExpression" as the first parameter ` +
                    `to the select call. Got "${expression.arguments[0]?.type}"`);
            }

            // TODO: We need to deal with an existing select...
            // Seems sources would be incorrect...
            //  They should be ResultColumns....

            // But... in the following example
            //  (c) => { foo: c.a, bar: c.b }
            // 
            // the column names would be foo and bar, and the source would be c
            //  (which would be changing in type on every statement that generates a select)

            // Right now sourccs are the contexts
            //  So we have the result colmns in the select....

            // The issue is right now we aren't relying on the select to determine the
            //  type of c... we are using the schema directly!!!

            const sources = buildSources(expression.arguments[0], ctx!);
            const selector = expression.arguments[0].body;
            switch (selector.type) {
                case `ObjectExpression`: {
                    const columns = selector.properties.map(
                        (property) => {
                            if (property.type !== `Property`) {
                                throw new Error(`Expected Object.Expression.properties[n] to be a "Property"`);
                            }
                            const name = readName(property.key);
                            const { expression, implicitJoins } = prepare(property.value, schema, sources, global);
                            return {
                                name,
                                expression,
                                implicitJoins,
                            };
                        }
                    );
                                        
                }
                break;
                case `ArrayExpression`:
                    break;
                case `MemberExpression`:
                    break;
                case `Identifier`:
                    break;
                case `CallExpression`:
                    break;
                default:
                    throw new Error(
                        `Select may only return an object (column names and values), ` +
                        `Array (indexed column values) or a single value (As a MemberExpression, ` +
                        `Identifier or CallExpression)`
                    );
            }


    
            // TODO: We need a way to detect and required process joins....
            // TODO: Update this to use columns
            
            const { expression, implicitJoins } = prepare(expression.arguments[0].body, schema, sources, global);
            
            // TODO: This expression is all the columns....
            //  could be an unamed scalar or could be and object pattern
            // Could be a reference to a table (where we need to get all the columns....)



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

function memberExpressionRoot(expression: Expression<ExpressionTypeKey>) {
    if (expression.type !== `MemberExpression`) {
        return expression;
    }

    return memberExpressionRoot(expression.object);
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
            identifier: `${source.identifier}_${randString()}`,
            select: undefined,
            where: undefined,
            source: source,
        };
    }
}