import { convert } from '../convert/convert';
import { readName } from '../convert/util';
import { Queryable } from './queryable';
import {
    Expression as AstExpression,
    ExpressionTypeKey as AstExpressionTypeKey,
    Map
} from '../type';
import { parseFunction } from './parse';
import { SourceExpression } from '../tree/source';
import { SelectExpression } from '../tree/select';
import { Globals } from '../convert/global';
import { Column } from '../tree/column';
import { buildSources, varsName } from './util';
import { asArray, isScalar } from '../tree';

export const SCALAR_NAME = `__scalar__11cbd49f`;

export function select<TElement, TMapped, TArgs = undefined>(
    this: Queryable<TElement>,
    map: Map<TElement, TMapped>,
    args?: TArgs,
) {
    const ast = parseFunction(map, 1, args);

    let select: SelectExpression;
    if (this.expression instanceof SourceExpression) {
        const columns = transformSelect(
            [this.expression],
            ast,
            this.provider.globals,
        );
        select = new SelectExpression(columns, this.expression);
    } else if (this.expression instanceof SelectExpression) {
        const columns = transformSelect(
            [this.expression],
            ast,
            this.provider.globals,
        );

        select = new SelectExpression(
            columns,
            this.expression.source,
            this.expression.where,
            this.expression.join,
        );
    } else {
        throw new Error(`Expected either a source expression or a select expression`);
    }

    return new Queryable<TMapped>(
        this.provider,
        select,
    );
}

export function transformSelect(
    sources: (SelectExpression | SourceExpression)[],
    expression: AstExpression<`ArrowFunctionExpression`>,
    globals?: Globals,
): Column | Column[] {
    // TODO: If this select ends on a select expression, we need to get the scalar columns
    //  and add them

    const vars = varsName(expression);
    const sourceMap = buildSources(expression, ...sources);
    const columns = processColumns();
    return columns;

    function processColumns() {
        switch (expression.body.type) {
            case `ArrayExpression`:
                return expression.body.elements.map(
                    (element, index) => processColumn(element, String(index))
                ).flat();
            case `ObjectExpression`:
                return expression.body.properties.map(
                    (property) => {
                        if (property.type !== `Property`) {
                            throw new Error(`Expected ObjectExpression.properties to all be "Property" Expressions`);
                        }
                        const name = readName(property.key);
                        return processColumn(property.value, name as string);
                    }
                ).flat();
            default:
                return processColumn(expression.body);
        }
    }

    function processColumn(expression: AstExpression<AstExpressionTypeKey>, name = SCALAR_NAME): Column | Column[] {
        switch (expression.type) {
            case `Identifier`: {
                const source = sourceMap[expression.name as string];
                if (source && name === SCALAR_NAME && source instanceof SelectExpression || source instanceof SourceExpression) {
                    // We have a single identifier which is a source,
                    //  we need to return columns for all it's scalar types
                    return asArray(source.columns).filter(
                        (column) => isScalar(column.type)
                    );
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

        const { expression: exp, linkMap } = convert(
            sourceMap,
            expression,
            vars,
            globals,
        );

        return new Column(exp, name, linkMap);
    }
}

