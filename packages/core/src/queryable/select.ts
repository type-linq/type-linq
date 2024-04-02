import { EntitySource, Field, FieldSet, SelectExpression, Source, Walker } from '@type-linq/query-tree';
import { convert } from '../convert/convert.js';
import { readName } from '../convert/util.js';
import { Queryable } from './queryable.js';
import {
    Expression as AstExpression,
    ExpressionTypeKey as AstExpressionTypeKey,
    Map,
} from '../type.js';
import { parseFunction } from './parse.js';
import { Globals } from '../convert/global.js';
import { buildSources, varsName } from './util.js';

export const SCALAR_NAME = `__scalar__11cbd49f`;

export function select<TElement, TMapped, TArgs = undefined>(
    source: Queryable<TElement>,
    map: Map<TElement, TMapped>,
    args?: TArgs,
) {
    const ast = parseFunction(map, 1, args);3

    const transformed = transformSelect(
        [source.expression],
        ast,
        source.provider.globals,
    );

    let entitySource: SelectExpression | EntitySource | undefined;
    entitySource = Walker.findSource(source.expression, (exp) => exp instanceof SelectExpression) as SelectExpression | undefined;
    if (entitySource === undefined) {
        if (source.expression instanceof EntitySource) {
            entitySource = source.expression;
        }
    }

    if (entitySource === undefined) {
        throw new Error(`Unable to find a SelectExpression or EntitySource`);
    }

    // Now swap out the base of the branch
    const result = Walker.mapSource(entitySource, (exp) => {
        if (exp.source) {
            return exp;
        }

        // We always want a select at the base
        const result = new SelectExpression(entitySource!.entity, transformed);
        return result;
    });

    return new Queryable<TMapped>(
        source.provider,
        result,
    );
}

export function transformSelect(
    sources: Source[],
    expression: AstExpression<`ArrowFunctionExpression`>,
    globals?: Globals,
): FieldSet {
    const vars = varsName(expression);
    const sourceMap = buildSources(expression, ...sources);
    const fields = processFields();
    return fields;

    function processFields() {
        switch (expression.body.type) {
            case `ArrayExpression`: {
                const fields = expression.body.elements.map(
                    (element, index) => processField(element, String(index))
                ).flat();
                return new FieldSet(fields);
            }
            case `ObjectExpression`: {
                const fields = expression.body.properties.map(
                    (property) => {
                        if (property.type !== `Property`) {
                            throw new Error(`Expected ObjectExpression.properties to all be "Property" Expressions`);
                        }
                        const name = readName(property.key);
                        return processField(property.value, name as string);
                    }
                ).flat();
                return new FieldSet(fields);
            }
            default: {
                const fields = processField(expression.body);
                return new FieldSet(fields);
            }
        }
    }

    function processField(expression: AstExpression<AstExpressionTypeKey>, name = SCALAR_NAME): Field | Field[] {
        switch (expression.type) {
            case `Identifier`: {
                // We have a single identifier which is a source
                const source = sourceMap[expression.name as string];
                if (source && name === SCALAR_NAME && source instanceof Source) {
                    return new Field(source, name);
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

        return new Field(converted, name);
    }
}

