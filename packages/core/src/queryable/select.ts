import {
    EntitySource,
    Field,
    FieldSet,
    SelectExpression,
    Source,
    Walker
} from '@type-linq/query-tree';

import { convert } from '../convert/convert.js';
import { readName } from '../convert/util.js';
import {
    Expression as AstExpression,
    ExpressionTypeKey as AstExpressionTypeKey,
    Expression,
    Serializable,
} from '../type.js';
import { ExpressionSource, buildSources, varsName } from './util.js';
import { QueryProvider } from '../query-provider.js';

// TODO: Does this make sense in this file? Perhaps in a constants file?
export const SCALAR_NAME = `__scalar__11cbd49f`;

// TODO: Add the overload that accepts an integer index which allows for row_number

export function select(
    provider: QueryProvider,
    source: Source,
    ast: Expression<`ArrowFunctionExpression`>,
    args?: Serializable,
) {
    const transformed = transformSelect(
        [source],
        ast,
        provider,
        args,
    );

    const result = transformSource(source, transformed);
    return result;
}

export function transformSource<TSource extends Source>(
    source: TSource,
    fields: FieldSet,
) {
    if (source instanceof EntitySource) {
        return new SelectExpression(
            fields,
            false,
        );
    }

    // Now swap out the base of the branch
    // TODO: This isn't quite right... we don't want to go lower than an entitysource....
    const result = Walker.mapSource(source, (exp) => {
        if (exp.source) {
            return exp;
        }

        // We always want a select at the base
        const result = new SelectExpression(
            fields,
            exp instanceof SelectExpression ?
                exp.distinct :
                false
            );
        return result;
    }, undefined, (exp) => exp instanceof EntitySource);
    return result as TSource;
}

export function transformSelect(
    sources: ExpressionSource[],
    expression: AstExpression<`ArrowFunctionExpression`>,
    provider: QueryProvider,
    args?: Serializable,
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
                const name = readScalarName(expression.body);
                const fields = processField(expression.body, name);
                return new FieldSet(fields);
            }
        }
    }

    function processField(expression: AstExpression<AstExpressionTypeKey>, name: string): Field | Field[] {
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
            provider,
            vars,
            args,
            { convertLogical: true },
        );

        return new Field(converted, name);
    }

    function readScalarName(expression: AstExpression<AstExpressionTypeKey>) {
        switch (expression.type) {
            case `MemberExpression`:
                return readName(expression.property) as string;
            case `Literal`:
                return String(expression.value);
            case `CallExpression`:
                return readScalarName(expression.callee);
            default:
                return SCALAR_NAME;
        }
    }
}

