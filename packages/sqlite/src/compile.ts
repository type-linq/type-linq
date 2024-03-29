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
} from '@type-linq/query-tree';

export type SqlFragment = {
    sql: string;
    variables: Serializable[];
}

// TODO: Go through and make sur we have all exprssion types

export function compile(expression: Source): SqlFragment {
    let select: SelectExpression = undefined!;
    let whereExpression: WhereExpression = undefined!;
    const joinExpressions: JoinExpression[] = [];

    Walker.walkSource(expression, (exp) => {
        if (exp instanceof SelectExpression) {
            if (select) {
                throw new Error(`Mutliple SelectExpressions found on branch`);
            }
            select = exp;
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

        throw new Error(`Unexpected source expression type "${exp.constructor.name}" received`);
    });

    if (select === undefined) {
        throw new Error(`No SelectExpression was found on the branch`);
    }

    const fields = compileExpression(select.fieldSet);
    const from = compileExpression(select.entity);    
    const joins = joinExpressions.map(processJoinExpression);
    const where = whereExpression ?
        compileExpression(whereExpression.clause) :
        undefined;
    
    const parts: string[] = [
        `SELECT`,
        fields.sql,
        `FROM ${from.sql}`,
        ...joins.map((jn) => jn.sql),
    ];

    if (where) {
        parts.push(
            `WHERE ${where.sql}`
        );
    }

    return {
        sql: parts.join(`\n`),
        variables: [
            ...fields.variables,
            ...from.variables,
            ...joins.map((jn) => jn.variables).flat(),
            ...(where ? where.variables : []),
        ]
    };
}

function compileExpression(expression: Expression): SqlFragment {
    // TODO: We need to handle aliasing!

    switch (true) {
        case expression instanceof JoinExpression:
        case expression instanceof SelectExpression:
        case expression instanceof WhereExpression:
            throw new Error(`Expected "${expression.constructor.name}" to be handled externally`);

        case expression instanceof EntitySource: {
            return compileExpression(expression.entity);
        }
        case expression instanceof Field: {
            const expr = compileExpression(expression.source);
            const name = compileExpression(expression.name);

            return {
                sql: `${expr.sql} AS ${name.sql}`,
                variables: [...expr.variables, ...name.variables],
            };
        }
        case expression instanceof BinaryExpression: {
            // TODO: Need to add brackets in the correct places
            const { sql: left, variables: leftVariables } = compileExpression(expression.left);
            const { sql: right, variables: rightVariables } = compileExpression(expression.right);

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
            const { sql: left, variables: leftVariables } = compileExpression(expression.left);
            const { sql: right, variables: rightVariables } = compileExpression(expression.right);

            const sql = generateLogicalSql(left, expression.operator, right);
            return {
                sql,
                variables: [...leftVariables, ...rightVariables],
            };
        }
        case  expression instanceof SubSource: {
            // TODO
            throw new Error(`not implemented`);
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
            const callee = compileExpression(expression.callee);
            const args = compileExpression(expression.arguments);

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
            const args = expression.arguments.map(compileExpression);

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
            const exp = expression as EntityIdentifier;
            return {
                sql: encodeIdentifier(exp.name),
                variables: [],
            };
        }
        case expression instanceof FieldIdentifier: {
            const exp = expression as FieldIdentifier;
            const source = compileExpression(exp.source);
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
            const fields = expression.fields.map(compileExpression);
            return {
                sql: `\t${fields.map((fld) => fld.sql).join(`,\n\t`)}`,
                variables: fields.map((fld) => fld.variables).flat(),
            };

        }
        case expression instanceof CaseBlock: {
            const test = compileExpression(expression.test);
            const consequent = compileExpression(expression.consequent);
            return {
                sql: `WHEN ${test.sql} THEN ${consequent.sql}`,
                variables: [...test.variables, ...consequent.variables],
            };
        }
        case expression instanceof CaseBlocks: {
            const blocks = expression.when.map(compileExpression);
            return {
                sql: blocks.map((block) => `\t${block.sql}`).join(`\n`),
                variables: blocks.map((block) => block.variables).flat(),
            };
        }
        case expression instanceof CaseExpression: {
            const blocks = compileExpression(expression.when);
            const alternate = compileExpression(expression.alternate);
            return {
                sql: `CASE\n${blocks.sql}\n\tELSE ${alternate.sql}\nEND`,
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
            return compileExpression(caseExpression);
        }
        case expression instanceof UnaryExpression: {
            const unary = expression as UnaryExpression;
            const { sql, variables } = compileExpression(unary.expression);
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

function processJoinExpression(join: JoinExpression): SqlFragment {
    const clause = compileExpression(join.condition);
    const inner = compileExpression(join.joined);
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

