import { Serializable } from '@type-linq/core';
import {
    BinaryExpression,
    BinaryOperator,
    LogicalExpression,
    LogicalOperator,
    EqualityOperator,
    CallExpression,
    CaseBlock,
    CaseExpression,
    Expression,
    ExpressionType,
    GlobalIdentifier,
    JoinClause,
    JoinExpression,
    Literal,
    SelectExpression,
    TernaryExpression,
    UnaryExpression,
    VariableExpression,
    EntityIdentifier,
    FieldIdentifier,
    FromExpression,
    WhereExpression,
    Walker,
    Alias,
} from '@type-linq/query-tree';

export type SqlFragment = {
    sql: string;
    variables: Serializable[];
}

export function compile(expression: Expression<ExpressionType>): SqlFragment {
    switch (expression.expressionType) {
        case `BinaryExpression`: {
            // TODO: Need to add brackets in the correct places
            const binary = expression as BinaryExpression;
            const { sql: left, variables: leftVariables } = compile(binary.left);
            const { sql: right, variables: rightVariables } = compile(binary.right);

            const sql = generateBinarySql(left, binary.operator, right);
            return {
                sql,
                variables: [...leftVariables, ...rightVariables],
            };
        }
        case `LogicalExpression`: {
            // TODO: Need to add brackets in the correct places

            const logical = expression as LogicalExpression;
            const { sql: left, variables: leftVariables } = compile(logical.left);
            const { sql: right, variables: rightVariables } = compile(logical.right);

            const sql = generateLogicalSql(left, logical.operator, right);
            return {
                sql,
                variables: [...leftVariables, ...rightVariables],
            };
        }
        case `VariableExpression`: {
            const variable = expression as VariableExpression;
            
            let value: Serializable;
            if (variable.bound) {
                value = variable.access() as Serializable;
            } else {
                // TODO: late bound vars
                throw new Error(`not implemented`);
            }
            return {
                sql: `?`,
                variables: [value],
            };
        }
        case `CallExpression`: {
            const call = expression as CallExpression;
            const callee = compile(call.callee);
            const args = call.arguments.map(compile);

            const sql = `${callee.sql}(${args.map((a) => a.sql).join(`, `)})`;
            return {
                sql,
                variables: [
                    ...callee.variables,
                    ...args.map((a) => a.variables).flat()
                ]
            }
        }
        case `CaseBlock`:
            return processCaseBlock(expression as CaseBlock);
        case  `CaseExpression`:
            return processCaseExpression(expression as CaseExpression);
        case `GlobalIdentifier`:
            return {
                sql: (expression as GlobalIdentifier).name,
                variables: []
            };
        case `EntityIdentifier`: {
            const exp = expression as EntityIdentifier;
            return {
                sql: encodeIdentifier(exp.name),
                variables: [],
            };
        }
        case `FieldIdentifier`: {
            const exp = expression as FieldIdentifier;
            const source = compile(exp.source);
            return {
                sql: `${source.sql}.${encodeIdentifier(exp.name)}`,
                variables: [...source.variables],
            };
        }
        case `Alias`: {
            const exp = expression as Alias<Expression>;
            const source = compile(exp.expression);
            return {
                sql: `${source.sql} AS ${encodeIdentifier(exp.alias)}`,
                variables: [...source.variables],
            };
        }
        case `JoinExpression`:
            return processJoinExpression(expression as JoinExpression);
        case `Literal`:
            return {
                sql: encodePrimitive((expression as Literal).value),
                variables: []
            };
        case `SelectExpression`:
            return processSelectExpression(expression as SelectExpression);
        case `FromExpression`: {
            const from = expression as FromExpression;
            return compile(from.entity);
        }
        case `WhereExpression`:
            throw new Error(`Expected the select expression handler to handle the where expressions`);
        case `TernaryExpression`: {
            const ternary = expression as TernaryExpression;
            const caseBlock = new CaseBlock(
                ternary.test,
                ternary.consequent,
            );

            const caseExpression = new CaseExpression([caseBlock], ternary.alternate);
            return compile(caseExpression);
        }
        case `UnaryExpression`: {
            const unary = expression as UnaryExpression;
            const { sql, variables } = compile(unary.expression);
            return {
                sql: `NOT ${sql}`,
                variables: variables,
            };
        }
        default:
            throw new Error(`Unkown expression type "${expression.expressionType}" received`);
    }
}

function encodeIdentifier(identifier: string) {
    return `[${identifier.replace(/\[/g, `[[`)}]`;
}

function encodePrimitive(value: string | number | boolean | null | undefined) {
    if (value == null) {
        return `NULL`;
    }

    if (typeof value !== `string`) {
        return String(Number(value));
    }

    return `'${value.replace(/'/g, `''`)}'`;
}

function processCaseBlock(block: CaseBlock): SqlFragment {
    const test = compile(block.test);
    const consequent = compile(block.consequent);
    return {
        sql: `WHEN ${test.sql} THEN ${consequent.sql}`,
        variables: [...test.variables, ...consequent.variables],
    };
}

function processCaseExpression(expression: CaseExpression): SqlFragment {
    const blocks = expression.when.map(processCaseBlock);
    const alternate = compile(expression.alternate);

    return {
        sql: `CASE\n\t${blocks.join(`\n\t`)}\n\tELSE ${alternate.sql}\nEND`,
        variables: [...blocks.map((block) => block.variables).flat(), ...alternate.variables],
    };
}

function processJoinClause(clause: JoinClause): SqlFragment {
    const left = compile(clause.left);
    const right = compile(clause.right);

    const sql = generateJoinSql(left.sql, clause.operator, right.sql);
    return {
        sql,
        variables: [...left.variables, ...right.variables],
    };
}

function processJoinExpression(join: JoinExpression): SqlFragment {
    const clauses = join.join.map(
        (clause) => processJoinClause(clause)
    );
    const clausesSql = clauses
        .map((clause) => clause.sql)
        .join(`\n\tAND `);

    const inner = compile(join.joined);
    const sql = `JOIN ${inner.sql} ON\n\t${clausesSql}`;

    return {
        sql,
        variables: [
            ...inner.variables,
            ...clauses.map((clause) => clause.variables).flat()
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
            return `${left} == ${right}`;
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

function generateJoinSql(left: string, operator: EqualityOperator, right: string) {
    if (operator !== `==`) {
        throw new Error(`Unsupported operator "${operator}" received`);
    }

    return `${left} = ${right}`;
}

function processSelectExpression(select: SelectExpression): SqlFragment {
    const fields = select.fieldsArray.map((field) => {
        const compiled = compile(field);
        return compiled;
    });

    const joins = Walker.collectBranch(select, (exp) => {
        return exp instanceof JoinExpression;
    });

    const wheres = Walker.collectBranch(select, (exp) => {
        return exp instanceof WhereExpression;
    }) as WhereExpression[];

    const firstWhere = wheres.shift();
    const combinedClause = firstWhere &&
        wheres.reduce(
            (result, where) => new LogicalExpression(
                result,
                `&&`,
                where.clause
            ),
            firstWhere.clause,
        );

    const from = Walker.source(select);

    const compiledJoins = joins.map(compile);
    const compiledWhere = combinedClause && compile(
        combinedClause
    );
    const compiledFrom = compile(from);

    const parts = [
        `SELECT ${fields.map((f) => f.sql).join(`, `)}`,
        `FROM ${compiledFrom.sql}`,
        ...compiledJoins.map((j) => j.sql),
    ].filter(Boolean);

    if (compiledWhere) {
        parts.push(`WHERE ${compiledWhere.sql}`);
    }

    const sql = parts.join(`\n`);
    const variables = [
        ...fields.map((f) => f.variables).flat(),
        ...compiledFrom.variables,
        ...compiledJoins.map((j) => j.variables).flat(),
    ];

    if (compiledWhere) {
        variables.push(...compiledWhere.variables);
    }

    return {
        sql,
        variables,
    };
}
