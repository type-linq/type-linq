import {
    BinaryExpression,
    BinaryOperator,
    LogicalExpression,
    LogicalOperator,
    EqualityOperator,
    CallExpression,
    CaseBlock,
    CaseExpression,
    Column,
    Expression,
    ExpressionType,
    GlobalExpression,
    Identifier,
    JoinClause,
    JoinExpression,
    Literal,
    SelectExpression,
    SourceExpression,
    TernaryExpression,
    UnaryExpression,
    VariableExpression,
    Serializable,
} from '@type-linq/core';

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
                value = variable.access();
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
        case `Column`: {
            const column = expression as Column;
            const { sql, variables } = compile(column.expression);
            return {
                sql: `${sql} as ${encodeIdentifier(column.name)}`,
                variables,
            };
        }
        case `GlobalExpression`:
            return {
                sql: (expression as GlobalExpression).name,
                variables: []
            };
        case `Identifier`: {
            const identifier = expression as Identifier;
            const sql = [...identifier.scope, identifier.name].map(
                encodeIdentifier
            ).join(`.`);
            return {
                sql,
                variables: []
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
        case `SourceExpression`: {
            const source = expression as SourceExpression;
            const resource = encodeIdentifier(source.resource);
            const name = encodeIdentifier(source.name);
            return {
                sql: `${resource} AS ${name}`,
                variables: []
            };
        }
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

    // TODO: We need to be able to give our own name here!
    // Source expressions are applying their own names!
    // TODO: The join expressions should create new source expressions....

    const inner = compile(join.source);
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
    const columns = asArray(select.columns).map((column) => {
        const { sql, variables } = compile(column.expression);
        return {
            sql: `${sql} AS ${encodeIdentifier(column.name)}`,
            variables,
        };
    });
    const joins = select.join.map(compile);

    const column = {
        sql: columns.map((c) => c.sql).join(`, `),
        variables: columns.map((c) => c.variables).flat(),
    };

    // TODO: Need to add brackets if this is not a source expression
    // TODO: This is coming out as [Products].[Products]
    const from = compile(select.source);
    
    const join = {
        sql: joins.map((j) => j.sql).join(`\n`),
        variables: columns.map((c) => c.variables).flat(),
    };

    const where = select.where === undefined ?
        undefined :
        compile(select.where);

    const parts = [
        `SELECT ${column.sql}`,
        `FROM ${from.sql}`,
        join.sql,
    ].filter(Boolean);

    if (where) {
        parts.push(`WHERE ${where.sql}`);
    }

    const sql = parts.join(`\n`);
    const variables = [
        ...column.variables,
        ...from.variables,
        ...join.variables,
    ];

    if (where) {
        variables.push(...where.variables);
    }

    return {
        sql,
        variables,
    };
}

function asArray<T>(value: T | T[]): T[] {
    if (Array.isArray(value)) {
        return value;
    } else {
        return [value];
    }
}
