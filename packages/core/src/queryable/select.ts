import { Alias, Expression, Field, SelectExpression, SourceExpression } from '@type-linq/query-tree';
import { convert } from '../convert/convert';
import { readName } from '../convert/util';
import { Queryable } from './queryable';
import {
    Expression as AstExpression,
    ExpressionTypeKey as AstExpressionTypeKey,
    Map
} from '../type';
import { parseFunction } from './parse';
import { Globals } from '../convert/global';
import { buildSources, varsName } from './util';

export const SCALAR_NAME = `__scalar__11cbd49f`;

export function select<TElement, TMapped, TArgs = undefined>(
    this: Queryable<TElement>,
    map: Map<TElement, TMapped>,
    args?: TArgs,
) {
    const ast = parseFunction(map, 1, args);

    const fields = transformSelect(
        [this.expression],
        ast,
        this.provider.globals,
    );

    // Now we need to remove any other select in the main branch
    const expression = Expression.walkBranchMutate(this.expression, (exp) => {
        if (exp instanceof SelectExpression) {
            return exp.source;
        } else {
            return exp;
        }
    });

    // Finally add a new select
    const select = new SelectExpression(expression, fields);
    return new Queryable<TMapped>(
        this.provider,
        select,
    );
}

export function transformSelect(
    sources: SourceExpression[],
    expression: AstExpression<`ArrowFunctionExpression`>,
    globals?: Globals,
): Field | Field[] {
    const vars = varsName(expression);
    const sourceMap = buildSources(expression, ...sources);
    const fields = processFields();
    return fields;

    function processFields() {
        switch (expression.body.type) {
            case `ArrayExpression`:
                return expression.body.elements.map(
                    (element, index) => processField(element, String(index))
                ).flat();
            case `ObjectExpression`:
                return expression.body.properties.map(
                    (property) => {
                        if (property.type !== `Property`) {
                            throw new Error(`Expected ObjectExpression.properties to all be "Property" Expressions`);
                        }
                        const name = readName(property.key);
                        return processField(property.value, name as string);
                    }
                ).flat();
            default:
                return processField(expression.body);
        }
    }

    function processField(expression: AstExpression<AstExpressionTypeKey>, name = SCALAR_NAME): Field | Field[] {
        switch (expression.type) {
            case `Identifier`: {
                // We have a single identifier which is a source
                const source = sourceMap[expression.name as string];
                if (source && name === SCALAR_NAME && source instanceof SourceExpression) {
                    return new Alias(source, name);
                }
            }
            break;
            case `MemberExpression`:
            case `CallExpression`:
            case `Literal`:
            case `TemplateLiteral`:
                break;
            default:
                throw new Error(`Unsupported column Expression.type "${expression.type}"`);
        }

        const converted = convert(
            sourceMap,
            expression,
            vars,
            globals,
        );

        return new Alias(converted, name);
    }
}

