import { convert } from '../convert/convert';
import { readName } from '../convert/util';
import { Queryable } from './queryable';
import { Expression, ExpressionType } from '../tree/expression';
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
            this.expression,
            ast,
            this.provider.globals,
        );
        select = new SelectExpression(columns, this.expression);
    } else if (this.expression instanceof SelectExpression) {
        const columns = transformSelect(
            this.expression,
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

    return new Queryable<TElement>(
        this.provider,
        select,
    );
}

export function transformSelect(
    source: SelectExpression | SourceExpression,
    expression: AstExpression<`ArrowFunctionExpression`>,
    globals?: Globals,
): Column | Column[] {
    const varsName = expression.params.length > 1 ?
        readName(expression.params.at(-1)!) :
        undefined;

    const sourceName = expression.params.length > 0 ?
        readName(expression.params[0]) :
        undefined;

    const sources: Record<string | symbol, Expression<ExpressionType>> = {};
    if (sourceName !== undefined) {
        sources[sourceName] = source;
    }

    const columns = processColumns();
    return columns;

    function processColumns() {
        switch (expression.body.type) {
            case `ArrayExpression`:
                return expression.body.elements.map(
                    (element, index) => processColumn(element, String(index))
                );
            case `ObjectExpression`:
                return expression.body.properties.map(
                    (property) => {
                        if (property.type !== `Property`) {
                            throw new Error(`Expected ObjectExpression.properties to all be "Property" Expressions`);
                        }
                        const name = readName(property.key);
                        return processColumn(property.value, name as string);
                    }
                );
            default:
                return processColumn(expression.body);
        }
    }

    function processColumn(expression: AstExpression<AstExpressionTypeKey>, name = SCALAR_NAME): Column {
        switch (expression.type) {
            case `Identifier`:
            case `MemberExpression`:
            case `CallExpression`:
                break;
            default:
                throw new Error(`Unsupported column Expression.type "${expression.type}"`);
        }

        const { expression: exp, linkChains } = convert(
            sources,
            expression,
            varsName,
            globals,
        );

        return new Column(exp, name, undefined, linkChains);
    }
}

