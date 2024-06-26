import { Expression, Field } from '@type-linq/query-tree';
import { readName } from '../convert/util.js';
import { Expression as AstExpression, ExpressionTypeKey, Serializable } from '../type.js';
import { SCALAR_NAME } from './select.js';
import { convert } from '../convert/convert.js';
import { Globals } from '../convert/global.js';

export function buildSources(ast: AstExpression<`ArrowFunctionExpression`>, ...sources: Expression[]) {
    return sources.reduce(
        (result, source, index) => {
            const name = ast.params.length > index ?
                readName(ast.params[index]) as string :
                undefined;

            if (name === undefined) {
                return result;
            }

            result[name] = source;
            return result;
        },
        { } as Record<string, Expression>
    );
}

export function varsName(ast: AstExpression<`ArrowFunctionExpression`>) {
    const lastParam = ast.params.at(-1);
    if (lastParam === undefined) {
        return undefined;
    }

    if (lastParam.type !== `Identifier`) {
        return undefined;
    }

    return lastParam.name as string;
}

export function asArray<T>(value: T | T[]): T[] {
    if (Array.isArray(value)) {
        return value;
    } else {
        return [value];
    }
}

export function processKey(
    args: Serializable | undefined,
    globals: Globals | undefined,
    expression: AstExpression<`ArrowFunctionExpression`>,
    ...sources: Expression[]
): Field[] | Field {
    const sourceMap = buildSources(expression, ...sources);
    const vars = varsName(expression);

    switch (expression.body.type) {
        case `ArrayExpression`:
            return expression.body.elements.map(
                (element, index) => processKeyValue(args, globals, element, String(index), vars, sourceMap)
            );
        case `ObjectExpression`:
            return expression.body.properties.map(
                (property) => {
                    if (property.type !== `Property`) {
                        throw new Error(`Expected ObjectExpression.properties to all be "Property" Expressions`);
                    }
                    const name = readName(property.key) as string;
                    return processKeyValue(args, globals, property.value, name, vars, sourceMap);
                }
            );
        default: {
            let name: string;
            switch (expression.body.type) {
                case `MemberExpression`:
                    name = readName(expression.body.property) as string;
                    break;
                case `Literal`:
                    name = String(expression.body.value);
                    break;
                default:
                    name = SCALAR_NAME;
                    break;
            }
            return processKeyValue(args, globals, expression.body, name, vars, sourceMap);
        }
    }
}

function processKeyValue(
    args: Serializable | undefined,
    globals: Globals | undefined,
    expression: AstExpression<ExpressionTypeKey>,
    name: string,
    varsName: string | undefined,
    sources: Record<string, Expression>,
) {
    switch (expression.type) {
        case `Identifier`:
        case `MemberExpression`:
        case `CallExpression`:
        case `Literal`:
        case `TemplateLiteral`:
            break;
        default:
            throw new Error(`Unsupported column Expression.type "${expression.type}"`);
    }

    const converted = convert(
        sources,
        expression,
        varsName,
        globals,
        args,
    );

    return new Field(converted, name);
}