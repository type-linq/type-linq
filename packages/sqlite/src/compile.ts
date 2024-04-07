import { Serializable } from '@type-linq/core';
import {
    BinaryExpression,
    BinaryOperator,
    LogicalExpression,
    LogicalOperator,
    CallExpression,
    Expression,
    GlobalIdentifier,
    JoinExpression,
    Literal,
    SelectExpression,
    TernaryExpression,
    UnaryExpression,
    VariableExpression,
    EntityIdentifier,
    FieldIdentifier,
    WhereExpression,
    Walker,
    LiteralValue,
    CallArguments,
    SubSource,
    EntitySource,
    CaseBlock,
    CaseBlocks,
    CaseExpression,
    FieldSet,
    Source,
    Field,
    Identifier,
    Boundary,
    MatchExpression,
    CastExpression,
    Type,
    StringType,
    NumberType,
    BooleanType,
    DateType,
    BinaryType,
    NullType,
    FunctionType,
    EntityType,
    UnknownType,
    UnionType,
    OrderExpression,
} from '@type-linq/query-tree';
import { formatter } from './formatter.js';

export type SqlFragment = {
    sql: string;
    variables: Serializable[];
}

type CompileInfo = {
    boundary: string[];
    alias: Record<string, string>;
    count: Record<string, number>;
    aliasSource?: boolean;
    aliasField?: boolean;
    fmt: (strings: TemplateStringsArray, ...inserts: string[]) => string;

    // TODO: Something to know to process logical with ands and ors
    //  or with binary operators?
    //  Or.... in places (like field select) where we don't need it, get
    //      the convert step to produce BinaryExpressions?
}

// TODO: Go through and make sur we have all exprssion types

export function compile(expression: Source): SqlFragment {
    let select: SelectExpression = undefined!;
    let whereExpression: WhereExpression = undefined!;
    const joinExpressions: JoinExpression[] = [];
    const orderExpressions: OrderExpression[] = [];

    Walker.walkSource(expression, (exp) => {
        if (exp instanceof SelectExpression) {
            if (select) {
                throw new Error(`Mutliple SelectExpression or EntitySource found on branch`);
            }
            select = exp;
            return;
        }

        if (exp instanceof EntitySource) {
            if (select) {
                throw new Error(`Mutliple SelectExpression or EntitySource found on branch`);
            }
            select = new SelectExpression(
                exp.entity,
                exp.fieldSet.scalars(),
            );
            return;
        }

        if (exp instanceof WhereExpression) {
            if (whereExpression) {
                throw new Error(`Mutliple WhereExpressions found on branch`);
            }
            whereExpression = exp;
            return;
        }

        if (exp instanceof JoinExpression) {
            joinExpressions.push(exp);
            return;
        }

        if (exp instanceof OrderExpression) {
            orderExpressions.push(exp);
            return;
        }

        throw new Error(`Unexpected source expression type "${exp.constructor.name}" received`);
    });

    if (select === undefined) {
        throw new Error(`No SelectExpression was found on the branch`);
    }

    const info: CompileInfo = {
        alias: {},
        boundary: [],
        count: {},
        fmt: formatter,
    };

    const fields = compileExpression(select.fieldSet, {
        ...info,
        aliasField: true,
    });
    const from = compileExpression(select.entity, info);
    const joins = joinExpressions.reverse().map((exp) => processJoinExpression(exp, info));
    const where = whereExpression ?
        compileExpression(whereExpression.clause, info) :
        undefined;
    
    const parts: string[] = [
        info.fmt`SELECT\n\t${fields.sql}`,
        info.fmt`FROM ${from.sql}`,
        ...joins.map((jn) => jn.sql),
    ];

    if (where) {
        parts.push(
            `WHERE ${where.sql}`
        );
    }

    const orders = orderExpressions.reverse().map(
        (expression) => {
            const { sql, variables } = compileExpression(
                expression.expression,
                info,
            );

            if (expression.descending) {
                return {
                    sql: `${sql} DESC`,
                    variables,
                };
            } else {
                return {
                    sql: `${sql} ASC`,
                    variables,
                }
            }
        }
    );

    if (orderExpressions.length > 0) {
        parts.push(info.fmt`ORDER BY\n\t${orders.map((ord) => ord.sql).join(`,\n`)}`)        
    }

    return {
        sql: parts.join(`\n`),
        variables: [
            ...fields.variables,
            ...from.variables,
            ...joins.map((jn) => jn.variables).flat(),
            ...(where ? where.variables : []),
            ...orders.map((ord) => ord.variables).flat(),
        ]
    };
}

function compileExpression(expression: Expression, info: CompileInfo): SqlFragment {
    switch (true) {
        case expression instanceof JoinExpression:
        case expression instanceof WhereExpression: {
            if (expression.fieldSet.scalar) {
                return compileExpression(expression.fieldSet.field.source, info);
            }
            throw new Error(`Unexpected "${expression.constructor.name}". Expected expression to be handled externally`);
        }
        case expression instanceof EntitySource: {
            return compileExpression(expression.entity, info);
        }
        case expression instanceof Boundary: {
            return compileExpression(expression.expression, {
                ...info,
                boundary: [...info.boundary, expression.identifier]
            });
        }
        case expression instanceof Field: {
            const expr = compileExpression(expression.source, info);
            if (!info.aliasField) {
                return expr;
            }
            
            const name = compileExpression(expression.name, info);
            return {
                sql: `${expr.sql} AS ${name.sql}`,
                variables: [...expr.variables, ...name.variables],
            };
        }
        case expression instanceof BinaryExpression: {
            // TODO: Need to add brackets in the correct places
            const { sql: left, variables: leftVariables } = compileExpression(expression.left, info);
            const { sql: right, variables: rightVariables } = compileExpression(expression.right, info);

            const sql = generateBinarySql(left, expression.operator, right);
            return {
                sql,
                variables: [...leftVariables, ...rightVariables],
            };
        }
        case expression instanceof LogicalExpression: {
            // TODO: Need to add brackets in the correct places
            // TODO: We need to process logical expressions in a separate function to track
            //  multiple expressions so we understand where to put the brackets.
            const { sql: left, variables: leftVariables } = compileExpression(expression.left, info);
            const { sql: right, variables: rightVariables } = compileExpression(expression.right, info);

            const sql = generateLogicalSql(left, expression.operator, right);
            return {
                sql,
                variables: [...leftVariables, ...rightVariables],
            };
        }
        case expression instanceof MatchExpression: {
            const { sql: left, variables: leftVariables } = compileExpression(expression.left, info);
            const { sql: right, variables: rightVariables } = compileExpression(expression.right, info);

            let match: string;
            switch (expression.operator) {
                case `start`:
                    match = `${right} || '%'`;
                    break;
                case `end`:
                    match = `'%' || ${right}`;
                    break;
                case `in`:
                    match = `'%' || ${right} || '%'`;
                    break;
                default:
                    throw new Error(`Unknown MatchExpression operator "${expression.operator}" received`);
            }

            const escape = expression.escape ?
                ` ESCAPE '${expression.escape}'` :
                ``;

            return {
                sql: `${left} LIKE ${match}${escape}`,
                variables: [...leftVariables, ...rightVariables],
            };
        }
        case  expression instanceof SubSource: {
            const { sql: entitySql, variables: entityVariables } = compileExpression(expression.entity, info);
            if (info.aliasSource) {
                const { sql: sourceSql, variables: sourceVariables } = compile(expression.source);
                return {
                    sql: info.fmt`(\n\t${sourceSql}\n) AS ${entitySql}`,
                    variables: [...sourceVariables, ...entityVariables],
                };
            }
            return {
                sql: entitySql,
                variables: entityVariables,
            };
        }
        case expression instanceof VariableExpression: {
            let value: Serializable;
            if (expression.bound) {
                value = expression.access() as Serializable;
            } else {
                // TODO: late bound vars
                throw new Error(`not implemented`);
            }
            return {
                sql: `?`,
                variables: [value],
            };
        }
        case expression instanceof CallExpression: {
            const callee = compileExpression(expression.callee, info);
            const args = compileExpression(expression.arguments, info);

            const sql = `${callee.sql}(${args.sql})`;
            return {
                sql,
                variables: [
                    ...callee.variables,
                    ...args.variables,
                ]
            }
        }
        case expression instanceof CallArguments: {
            const args = expression.arguments.map((arg) => compileExpression(arg, info));

            const sql = args.map((a) => a.sql).join(`, `);
            return {
                sql,
                variables: args.map((a) => a.variables).flat(),
            }
        }
        case expression instanceof GlobalIdentifier:
            return {
                sql: (expression as GlobalIdentifier).name,
                variables: []
            };
        case expression instanceof EntityIdentifier: {
            const boundId = [...info.boundary, expression.name].join(`/`);
            let alias = expression.name;
            if (info.alias[boundId]) {
                alias = info.alias[boundId];
            } else {
                info.count[expression.name] = info.count[expression.name] || 0;
                alias = defaultNamer(expression.name, info.count[expression.name]++);
                info.alias[boundId] = alias;
            }

            // TODO: Add a way to force alias
            if (info.aliasSource && alias !== expression.name) {
                return {
                    sql: `${encodeIdentifier(expression.name)} AS ${encodeIdentifier(alias)}`,
                    variables: [],
                };
            }

            return {
                sql: encodeIdentifier(alias),
                variables: [],
            };
        }
        case expression instanceof FieldIdentifier: {
            const exp = expression as FieldIdentifier;
            const source = compileExpression(exp.source, info);
            return {
                sql: `${source.sql}.${encodeIdentifier(exp.name)}`,
                variables: [...source.variables],
            };
        }
        case expression instanceof Literal:
            return {
                sql: encodePrimitive((expression as Literal).value),
                variables: []
            };
        case expression instanceof FieldSet: {
            const fields = expression.fields.map((field) => compileExpression(field, info));
            return {
                sql: fields.map((fld) => fld.sql).join(`,\n`),
                variables: fields.map((fld) => fld.variables).flat(),
            };

        }
        case expression instanceof CaseBlock: {
            const test = compileExpression(expression.test, info);
            const consequent = compileExpression(expression.consequent, info);
            return {
                sql: `WHEN ${test.sql} THEN ${consequent.sql}`,
                variables: [...test.variables, ...consequent.variables],
            };
        }
        case expression instanceof CastExpression: {
            const exp = compileExpression(expression.expression, info);
            const type = sqlType(expression.type);

            return {
                sql: `CAST(${exp.sql} AS ${type})`,
                variables: exp.variables,
            };
        }
        case expression instanceof CaseBlocks: {
            const blocks = expression.when.map((when) => compileExpression(when, info));
            return {
                sql: blocks.map((block) => `${block.sql}`).join(`\n`),
                variables: blocks.map((block) => block.variables).flat(),
            };
        }
        case expression instanceof CaseExpression: {
            const blocks = compileExpression(expression.when, info);
            const alternate = compileExpression(expression.alternate, info);
            return {
                sql: info.fmt`CASE\n\t${blocks.sql}\n\tELSE ${alternate.sql}\nEND`,
                variables: [...blocks.variables, ...alternate.variables],
            };
        }
        case expression instanceof TernaryExpression: {
            // TODO: We need to processs ternaries separately so we can combine nested....
            const ternary = expression as TernaryExpression;
            const caseBlock = new CaseBlock(
                ternary.test,
                ternary.consequent,
            );
            const caseBlocks = new CaseBlocks([caseBlock]);
            const caseExpression = new CaseExpression(caseBlocks, ternary.alternate);
            return compileExpression(caseExpression, info);
        }
        case expression instanceof UnaryExpression: {
            const unary = expression as UnaryExpression;
            const { sql, variables } = compileExpression(unary.expression, info);
            return {
                sql: `NOT ${sql}`,
                variables: variables,
            };
        }
        case expression instanceof Identifier: {
            return {
                sql: encodeIdentifier(expression.name),
                variables: [],
            };
        }
        default:
            throw new Error(`Unkown expression type "${expression.constructor.name}" received`);
    }
}

function encodeIdentifier(identifier: string) {
    return `[${identifier.replace(/\[/g, `[[`)}]`;
}

function encodePrimitive(value: LiteralValue) {
    if (value == null) {
        return `NULL`;
    }

    if (value instanceof Date) {
        return encodePrimitive(value.toISOString());
    }

    if (typeof value !== `string`) {
        return String(Number(value));
    }

    return `'${value.replace(/'/g, `''`)}'`;
}

function processJoinExpression(join: JoinExpression, info: CompileInfo): SqlFragment {
    const clause = compileExpression(join.condition, info);
    const inner = compileExpression(join.joined, {
        ...info,
        aliasSource: true,
    });
    const sql = `JOIN ${inner.sql}\n\tON ${clause.sql}`;

    return {
        sql,
        variables: [
            ...inner.variables,
            ...clause.variables,
        ],
    };
}

function generateBinarySql(left: string, operator: BinaryOperator, right: string) {
    switch (operator) {
        case `<`:
            return `${left} < ${right}`;
        case `<=`:
            return `${left} <= ${right}`;
        case `>`:
            return `${left} > ${right}`;
        case `>=`:
            return `${left} >= ${right}`;
        case `&&`:
            return `(CASE ${left} WHEN NULL THEN NULL WHEN '' THEN '' WHEN 0 THEN 0 ELSE ${right} END)`;
        case `||`:
            return `(CASE ${left} WHEN NULL THEN ${right} WHEN '' THEN ${right} WHEN 0 THEN ${right} ELSE ${left} END)`;
        case `-`:
            return `${left} - ${right}`;
        case `+`:
            return `${left} + ${right}`;
        case `%`:
            return `${left} % ${right}`;
        case `??`:
            return `COALESCE(${left}, ${right})`;
        case `*`:
            return `${left} * ${right}`;
        case `/`:
            return `${left} / ${right}`;
        case `!=`:
            return `${left} != ${right}`;
        case `==`:
            return `${left} = ${right}`;
        default:
            throw new Error(`Operator "${operator}" is not supported`);
    }
}

function generateLogicalSql(left: string, operator: LogicalOperator, right: string) {
    switch (operator) {
        case `&&`:
            return `${left} and ${right}`;
        case `||`:
            return `${left} or ${right}`;
        case `??`:
            return `COALESCE(${left}, ${right})`;
        default:
            throw new Error(`Operator "${operator}" is not supported`);
    }
}

function defaultNamer(name: string, count: number) {
    if (count === 0) {
        return name;
    }
    return `${name}_${count}`;
}

function sqlType(type: Type) {
    switch (true) {
        case type instanceof StringType:
            return `TEXT`;
        case type instanceof NumberType:
            return `REAL`;
        case type instanceof BooleanType:
            return `INTEGER`;
        case type instanceof DateType:
            // TODO: Needs to be configurable
            return `TEXT`;
        case type instanceof BinaryType:
        case type instanceof NullType:
        case type instanceof FunctionType:
        case type instanceof EntityType:
        case type instanceof UnknownType:
        case type instanceof UnionType:
            throw new Error(`Unable to convert "${type.constructor.name}" to a SQL type`);
        default:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            throw new Error(`Unknown type "${(type as any).constructor.name}" received`);
    }
}
