import { Expression, ExpressionType, Serializable } from '../../type';
import { ensureIdentifierParams } from './identifier-params';
import { walk } from '../../walk';

export function bindVars(expression: Expression<`ArrowFunctionExpression`>, count: number, args: unknown) {
    if (args !== null && typeof args === `object` && expression.params.length <= count) {
        // If we have args, but no parameter for them, use a spread operator so we
        //  can access the vars directly in the function
        expression.params[count] = {
            type: `ObjectPattern`,
            properties: Object.keys(args).map((name) => ({
                type: `Property`,
                key: { type: `Identifier`, name },
                computed: false,
                kind: `init`,
                method: false,
                shorthand: true,
                value: { type: `Identifier`, name },
            }))
        };
    }

    // First normalize the expressions
    ensureIdentifierParams(expression);

    const lastParam = expression.params.at(-1)!;
    if (expression.params.length < count || lastParam.type !== `Identifier`) {
        // No vars param (which should have been added during normalization
        //  unless there were no args supplied) which means nothing to do.
        return;
    }

    // Remove the vars param
    expression.params.length = count;

    // TODO: Don't think this is required anymore...

    /*
    const varsName = lastParam.name;
    walk(expression.body, (exp) => {
        if (exp.type !== ExpressionType.ExternalExpression) {
            return true;
        }
        const external = exp;
        exp = exp.expression;

        if (exp.type === ExpressionType.Identifier) {
            if (exp.name === varsName) {
                const varValue = readArgValue(varsName, exp);
                replace(varValue);
            }
            return true;
        }

        if (exp.type !== ExpressionType.MemberExpression) {
            return true;
        }

        if (isRootVars(exp)) {
            const varValue = readArgValue(varsName, exp);
            replace(varValue);
        }

        return true;

        function replace(varValue: Serializable) {
            const updated = buildVarExpression(varValue);
            external.expression = updated;
        }

        function buildVarExpression(varValue: Serializable) {
            const encoded = encode();
            return encoded;

            function encode() {
                switch (typeOf()) {
                    case `array`:
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        return encodeArray(varValue as any);
                    case `object`:
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        return encodeObject(varValue as any);
                    default:
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        return encodeLiteral(varValue as any);
                }
            }

            function encodeLiteral(varValue: Serializable): Expression<`Literal`> {
                const literal = {
                    type: ExpressionType.Literal,
                    value: varValue,
                    raw: JSON.stringify(varValue),
                } as Expression<ExpressionType.Literal>;
                return literal;
            }

            function encodeArray(varValue: Serializable[]): Expression<`ArrayExpression`> {
                const array = {
                    type: ExpressionType.ArrayExpression,
                    elements: varValue.map(buildVarExpression),
                } as Expression<`ArrayExpression`>;
                return array;
            }

            function encodeObject(varValue: Serializable): Expression<`ObjectExpression`> {
                const object = {
                    type: ExpressionType.ObjectExpression,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    properties: Object.fromEntries(varValue as any).map((entry: [string, Serializable]) => {
                        const [name, value] = entry;
                        const property = {
                            type: ExpressionType.Property,
                            key: {
                                type: `Identifier`,
                                name,
                            },
                            value: buildVarExpression(value),
                        } as Expression<`Property`>;

                        return property;
                    })
                } as Expression<`ObjectExpression`>;
                return object;
            }

            function typeOf() {
                if (Array.isArray(varValue)) {
                    return `array`;
                } else if (varValue === null) {
                    return `null`;
                } else {
                    return typeof varValue;
                }
            }
        }
    });

    function isRootVars(expression: Expression<`Identifier` | `MemberExpression`>) {
        if (expression.type === ExpressionType.Identifier) {
            return expression.name === varsName;
        }

        if (expression.object.type !== ExpressionType.MemberExpression && expression.object.type !== ExpressionType.Identifier) {
            throw new Error(`Expected expression object to be a MemberExpression or an Identifier`);
        }

        return isRootVars(expression.object as Expression<ExpressionType.Identifier | ExpressionType.MemberExpression>);
    }

    function readArgValue(varsName: string | symbol, expression: Expression<`Identifier` | `MemberExpression`>): Serializable {
        const value = read(expression);
        validateValue(value);
        return value;

        function read(expression: Expression<`Identifier` | `MemberExpression`>): Serializable {
            if (expression.type === `Identifier`) {
                if (expression.name !== varsName) {
                    throw new Error(`Got identifier which is not "${String(varsName)}"`);
                }
                return args as Serializable;
            }

            const root = read(expression.object as Expression<`Identifier` | `MemberExpression`>);

            let propertyName: string;
            switch (expression.property.type) {
                case `Identifier`:
                    propertyName = expression.property.name as string;
                    break;
                case `Literal`:
                    propertyName = String(expression.property.value);
                    break;
                default:
                    throw new Error(`Unexpected MemberExpression "Property"."type" "${expression.property.type}"`);
            }

            if (root === null || typeof root !== `object`) {
                throw new Error(`Unable to read property "${propertyName}" from undefined`);
            }

            return root[propertyName] as Serializable;                
        }

        function validateValue(value: Serializable) {
            if (value === null) {
                return true;
            }

            switch (typeof value) {
                case `string`:
                case `number`:
                case `bigint`:
                case `boolean`:
                case `undefined`:
                    return;
                case `object`:
                    if (Array.isArray(value)) {
                        value.forEach(validateValue);
                    } else {
                        Object.values(value).forEach((value) => validateValue(value as Serializable));
                    }
                    break;
                default:
                    throw new Error(`Unable to handle var with type "${typeof value}"`);
            }
        }
    }
    */
}
