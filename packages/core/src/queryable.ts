import { parse } from 'espree';
import { Enumerable } from './enumerable';
import { QueryProvider } from './query-provider';
import { Expression, ExpressionType, ExpressionTypeKey, Serializable } from './type';
import { mutateWalk, walk } from './walk';
import { SELECT, SOURCE, WHERE } from './constant';

export type Predicate<TElement, TArgs> = (element: TElement, args: TArgs) => boolean;
export type Map<TInput, TOutput> = (input: TInput) => TOutput;
export type Merge<TInput1, TInput2, TOutput> = (input1: TInput1, input2: TInput2) => TOutput;

// TODO: Need caching
// TODO: AST Validation? Probably best left for the provider

// TODO: Why... think a symbol would be a much better choice here....
const VARS_NAME = `vars_e1fbe530aced`;
const VARS_IDENTIFIER = {
    type: ExpressionType.Identifier,
    name: VARS_NAME,
} as Expression<ExpressionType.Identifier>

export class Queryable<TElement> extends Enumerable<TElement> {
    readonly provider: QueryProvider;

    // TODO: How can we represent a root item? Maybe a root item's expression is undefined?sick
    readonly expression: Expression<ExpressionTypeKey>;

    constructor(provider: QueryProvider, expression: Expression<ExpressionTypeKey>) {
        super();
        this.provider = provider;
        this.expression = expression;
    }

    [Symbol.asyncIterator](): AsyncGenerator<TElement> {
        return this.provider.execute(this);
    }

    #parse<TArgs extends unknown[], TResult>(handler: (...args: TArgs) => TResult) {
        // TODO: Caching
        const finalSource = `const f = ${handler.toString()}`;
        const ast = parse(finalSource, {
            ecmaVersion: `latest`
        });
        const unwrapped = this.#unwrap(ast);
        return unwrapped;
    }

    #unwrap(expression: Expression<ExpressionType.Program>) {
        if (expression.body.length !== 1) {
            throw new Error(`Exprected exactly one body expression`);
        }

        const root = expression.body[0];
        if (root.type !== `VariableDeclaration` || root.declarations.length !== 1) {
            throw new Error(`Expected exactly one variable declaration in the root`);
        }

        const declaration = root.declarations[0];
        if (!declaration || declaration.type !== `VariableDeclarator`) {
            throw new Error(`Expected single VariableDeclarator`);
        }

        const lambda = declaration.init;
        switch (lambda.type) {
            case ExpressionType.FunctionExpression:
            case ExpressionType.ArrowFunctionExpression:
                break;
            default:
                throw new Error(`Expected a "FunctionExpression" or "ArrowFunctionExpression"`);
        }

        if (lambda.type === ExpressionType.ArrowFunctionExpression && lambda.body.type !== `BlockStatement`) {
            return lambda as Expression<ExpressionType.ArrowFunctionExpression>;
        }

        if (lambda.body.type !== ExpressionType.BlockStatement) {
            throw new Error(`Expected a single BlockStatement as the body`);
        }

        const statements = lambda.body.body;
        if (statements[0]?.type !== `ReturnStatement`) {
            throw new Error(`Expected exactly one return statement`);
        }

        return {
            type: ExpressionType.ArrowFunctionExpression,
            params: lambda.params,
            body: statements[0].argument,
        } as Expression<ExpressionType.ArrowFunctionExpression>;
    }

    /** Ensures the vars param is standard identifier, and any references to it are member expressions */
    #normalizeParams(expression: Expression<`ArrowFunctionExpression`>, count: number) {
        // No args means nothing to bind
        if (expression.params.length < count + 1) {
            return;
        }
        const varsParam = expression.params[count];

        // Args is in the form we want, nothing to notmalize
        if (varsParam.type === `Identifier`) {
            return;
        }

        switch (varsParam.type) {
            case `ObjectPattern`:
            case `ArrayPattern`:
                break;
            default:
                // TODO: When we get an AssignmentPattern this will be triggered. Need to figure out default values
                //  (Which probably means we need args in this function? Or perhaps we will just read the default values in another place?)
                throw new Error(`Unable to process "${varsParam.type}" as vars param`);
        }

        const identifiers: Record<string, Expression<ExpressionType.Identifier | ExpressionType.Literal>[]> = {};
        identifierPath(varsParam, [VARS_IDENTIFIER]);

        // TODO: Make these external expressions
        const identifierExpressions: Record<string, Expression<ExpressionType.ExternalExpression>> = Object.fromEntries(
            Object.entries(identifiers).map(([identifier, path]) => {
                return [identifier, externalExpression(path.reverse())]
            })
        );

        // Replace vars param....
        expression.params[1] = VARS_IDENTIFIER;

        // Replace identifiers with member expressions
        expression.body = mutateWalk(expression.body, (expression) => {
            if (expression.type === `Identifier`) {
                if (expression.name in identifierExpressions) {
                    return identifierExpressions[expression.name as string];
                }
            }
            return expression;
        });

        function identifierPath(expression: Expression<ExpressionTypeKey>, path: Expression<ExpressionType.Identifier | ExpressionType.Literal>[]) {
            if (expression.type === ExpressionType.ObjectPattern) {
                for (const prop of expression.properties) {
                    if (prop.type !== ExpressionType.Property) {
                        throw new Error(`Recieved unexpected expression type "${prop.type}". Expected "${ExpressionType.Property}"`);
                    }

                    if (prop.key.type !== `Identifier` && prop.key.type !== `Literal`) {
                        throw new Error(`Unexpected "Property" key type "${prop.key.type}" received`);
                    }

                    if (prop.value.type === `Identifier`) {
                        identifiers[prop.value.name as string] = [...path, prop.key as Expression<ExpressionType.Identifier | ExpressionType.Literal>];
                    } else {
                        identifierPath(prop.value, [...path, prop.key as Expression<ExpressionType.Identifier | ExpressionType.Literal>]);
                    }
                }
            } else if (expression.type === ExpressionType.ArrayPattern) {
                for (let index = 0; index < expression.elements.length; index++) {
                    const element = expression.elements[index];
                    const indexer = { type: ExpressionType.Literal, value: index, raw: index } as Expression<ExpressionType.Literal>;
                    if (element.type === `Identifier`) {
                        identifiers[element.name as string] = [...path, indexer];
                    } else {
                        identifierPath(element, [...path, indexer]);
                    }
                }
            } else {
                throw new Error(`Unexpected expression type "${expression.type} received"`);
            }
        }

        function externalExpression(path: Expression<ExpressionType.Identifier | ExpressionType.Literal>[]): Expression<ExpressionType.ExternalExpression> {
            const memberExpression = {
                type: `MemberExpression`,
                object: path.length > 2 ?
                    externalExpression(path.slice(1)) :
                    path[1],
                property: path[0],
            } as Expression<ExpressionType.MemberExpression>;

            return {
                type: ExpressionType.ExternalExpression,
                expression: memberExpression,
            } as Expression<ExpressionType.ExternalExpression>;
        }


    }

    #bindArgs<TArgs>(expression: Expression<`ArrowFunctionExpression`>, count: number, args: TArgs) {
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
        this.#normalizeParams(expression, count);

        const lastParam = expression.params.at(-1)!;
        if (lastParam.type !== `Identifier` || lastParam.name !== VARS_NAME) {
            // No vars param (which should have been added during normalization
            //  unless there were no args supplied) means nothing to do.
            return;
        }

        // Remove the vars param
        expression.params.length = expression.params.length - 1;

        const varsName = lastParam.name as string;

        walk(expression.body, (exp) => {
            if (exp.type !== ExpressionType.ExternalExpression) {
                return true;
            }
            const external = exp;
            exp = exp.expression;

            if (exp.type === ExpressionType.Identifier) {
                if (exp.name === VARS_NAME) {
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
                return expression.name === VARS_NAME;
            }

            if (expression.object.type !== ExpressionType.MemberExpression && expression.object.type !== ExpressionType.Identifier) {
                throw new Error(`Expected expression object to be a MemberExpression or an Identifier`);
            }

            return isRootVars(expression.object as Expression<ExpressionType.Identifier | ExpressionType.MemberExpression>);
        }

        function readArgValue(varsName: string, expression: Expression<`Identifier` | `MemberExpression`>): Serializable {
            const value = read(expression);
            validateValue(value);
            return value;

            function read(expression: Expression<`Identifier` | `MemberExpression`>): Serializable {
                if (expression.type === `Identifier`) {
                    if (expression.name !== varsName) {
                        throw new Error(`Got identifier which is not "${varsName}"`);
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
    }

    #replaceParam(ast: Expression<`ArrowFunctionExpression`>, paramIndex: number, name: string | symbol) {
        if (ast.params.length <= paramIndex) {
            return;
        }
        if (ast.params[paramIndex].type !== `Identifier`) {
            throw new Error(`Expected the symbol parameter (${paramIndex}) to be an Identifier`);
        }

        const sourceParam = ast.params[paramIndex] as Expression<`Identifier`>;
        walk(ast.body, (exp) => {
            if (exp.type === `Identifier` && exp.name === sourceParam.name) {
                exp.name = name;
            }
            return true;
        });
        sourceParam.name = name;
    }

    where<TArgs = undefined>(predicate: Predicate<TElement, TArgs>, args?: TArgs) {
        const ast = this.#parse(predicate);

        if (args !== undefined) {
            this.#bindArgs(ast, 1, args);
        }

        // Bind the special identifiers
        this.#replaceParam(ast, 0, SOURCE);

        const whereExpression: Expression<`CallExpression`> = {
            type: `CallExpression`,
            callee: {
                type: `MemberExpression`,
                object: this.expression,
                property: {
                    type: `Identifier`,
                    name: WHERE,
                }
            },
            arguments: [ast],
        };

        return new Queryable<TElement>(
            this.provider,
            whereExpression,
        );
    }

    select<TMapped, TArgs = undefined>(map: Map<TElement, TMapped>, args?: TArgs) {
        const ast = this.#parse(map);
        if (args !== undefined) {
            this.#bindArgs(ast, 1, args);
        }

        // Bind the special identifiers
        this.#replaceParam(ast, 0, SOURCE);

        // TODO: Extract required joins

        const selectExpression: Expression<`CallExpression`> = {
            type: `CallExpression`,
            callee: {
                type: `MemberExpression`,
                object: this.expression,
                property: {
                    type: `Identifier`,
                    name: SELECT,
                }
            },
            arguments: [ast],
        };

        return new Queryable<TMapped>(
            this.provider,
            selectExpression,
        );
    }

    // join: <TInner, TKey, TResult>(
    //     inner: Enumerable<TInner>,
    //     outerExpression: Map<TElement, TKey>,
    //     innerExpression: Map<TInner, TKey>,
    //     map: Merge<TElement, TInner, TResult>,
    // ) => TResult,

    // aggregate
    // all
    // any
    // append
    // average
    // chunk
    // concat
    // contains
    // count
    // defaultIfEmpty
    // distinct
    // distinctBy
    // elementAt
    // elementAtOrDefault
    // except
    // exceptBy
    // first
    // firstOrDefault
    // groupBy
    // groupJoin
    // intersect
    // intersectBy
    // join
    // last
    // lastOrDefault
    // longCount
    // max
    // maxBy
    // min
    // minBy
    // order
    // orderBy
    // orderByDescending
    // prepend
    // revserse
    // select
    // selectMany
    // sequenceEqual
    // single
    // singleOrDefault
    // skip
    // skipLast
    // skipWhile
    // sum
    // take
    // takeLast
    // takeWhile
    // thenBy
    // thenByDescending
    // union
    // unionBy


    // cast
    // ofType
    // asQueryable
    // zip
}



