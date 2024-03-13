import { BinaryExpression, BinaryOperator, LogicalExpression, LogicalOperator } from '../../core/src/tree/binary';
import { CallExpression } from '../../core/src/tree/call';
import { Column } from '../../core/src/tree/column';
import { Expression, ExpressionType } from '../../core/src/tree/expression';
import { GlobalExpression } from '../../core/src/tree/global';
import { Identifier } from '../../core/src/tree/identifier';
import { Literal } from '../../core/src/tree/literal';
import { SourceExpression } from '../../core/src/tree/source';
import { UnaryExpression } from '../../core/src/tree/unary';
import { VariableExpression } from '../../core/src/tree/variable';
import { Serializable } from '../../core/src/type';

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
            throw new Error(`not implemented`);
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
        case `Identifier`: 
            return {
                sql: encodeIdentifier((expression as Identifier).name),
                variables: []
            };
        case `JoinClause`:
            throw new Error(`not implemented`);
        case `JoinExpression`:
            throw new Error(`not implemented`);
        case `Literal`:
            return {
                sql: encodePrimitive((expression as Literal).value),
                variables: []
            };
        case `SelectExpression`:
            throw new Error(`not implemented`);
        case `SourceExpression`: {
            const source = expression as SourceExpression;
            const resource = encodeIdentifier(source.resource);
            const name = encodeIdentifier(source.name);
            return {
                sql: `${resource}.${name}`,
                variables: []
            };
        }
        case `TernaryExpression`:
            throw new Error(`not implemented`);
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