import { Expression, ExpressionTypeKey } from '../type';
import {
    BinaryExpression,
    CallExpression,
    CaseBlock,
    CaseExpression,
    Column,
    ExpressionType,
    JoinExpression,
    LogicalExpression,
    Expression as QueryExpression,
    SelectExpression,
    SourceExpression,
    TernaryExpression,
    UnaryExpression,
    asArray
} from '../tree/index';

export function readName(expression: Expression<ExpressionTypeKey>) {
    if (expression.type !== `Identifier` && expression.type !== `Literal`) {
        throw new Error(`Expected expression to be Identifier or Literal`);
    }
    if (expression.type === `Identifier`) {
        return expression.name;
    } else {
        return String(expression.value);
    }
}

export function randString(length: number) {
    return Math.random().toString(36).substring(2, length + 2);
}

export function fetchSources(expression: QueryExpression<ExpressionType>): SourceExpression[] {
    switch (expression.expressionType) {
        case `BinaryExpression`: {
            // TODO: Need to add brackets in the correct places
            const binary = expression as BinaryExpression;
            const sources = [
                ...fetchSources(binary.left),
                ...fetchSources(binary.right),
            ];
            return sources;
        }
        case `LogicalExpression`: {
            const logical = expression as LogicalExpression;
            const sources = [
                ...fetchSources(logical.left),
                ...fetchSources(logical.right),
            ];
            return sources;
        }
        case `VariableExpression`: {
            return [];
        }
        case `CallExpression`: {
            const call = expression as CallExpression;
            const sources = [
                ...fetchSources(call.callee),
                ...call.arguments.map(fetchSources).flat(),
            ];
            return sources;
        }
        case `CaseBlock`: {
            const block = expression as CaseBlock;
            const sources = [
                ...fetchSources(block.test),
                ...fetchSources(block.consequent),
            ];
            return sources;
        }
        case  `CaseExpression`: {
            const exp = expression as CaseExpression;
            const sources = [
                ...exp.when.map(fetchSources).flat(),
                ...fetchSources(exp.alternate),
            ];
            return sources;
        }
        case `Column`: {
            const column = expression as Column;
            const sources = fetchSources(column.expression);
            return sources;
        }
        case `GlobalExpression`:
            return [];
        case `Identifier`: 
            return [];
        case `JoinExpression`: {
            const join = expression as JoinExpression;

            const clauses = join.join.map(
                (clause) => [...fetchSources(clause.left), ...fetchSources(clause.right)]
            ).flat();

            const sources = [
                ...fetchSources(join.source),
                ...clauses,
            ];
            return sources;
        }
        case `Literal`:
            return [];
        case `SelectExpression`: {
            const exp = expression as SelectExpression;
            const sources = [
                ...asArray(exp.columns).map(
                    (column) => fetchSources(column.expression)
                ).flat(),
                ...exp.join.map(fetchSources).flat(),
                ...fetchSources(exp.source),
            ];

            if (exp.where) {
                sources.push(...fetchSources(exp.where));
            }

            return sources;
        }
        case `SourceExpression`: {
            const source = expression as SourceExpression;
            return [source];
        }
        case `TernaryExpression`: {
            const exp = expression as TernaryExpression;
            const sources = [
                ...fetchSources(exp.test),
                ...fetchSources(exp.consequent),
                ...fetchSources(exp.alternate),
            ];
            return sources;
        }
        case `UnaryExpression`: {
            const unary = expression as UnaryExpression;
            return fetchSources(unary.expression);
        }
        default:
            throw new Error(`Unkown expression type "${expression.expressionType}" received`);
    }

}