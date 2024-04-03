import {
    BinaryExpression,
    BinaryOperator,
    CallExpression,
    EntityType,
    GlobalIdentifier,
    Literal,
    LogicalExpression,
    LogicalOperator,
    Expression as QueryExpression,
    Source,
    TernaryExpression,
    UnaryExpression,
    VariableExpression,
    Field,
    LinkedEntitySource,
    EntitySource,
    FieldIdentifier,
    Boundary,
    FunctionType,
    CallArguments,
} from '@type-linq/query-tree';
import { readName } from './util.js';
import { Expression, ExpressionTypeKey, Operator, Serializable } from '../type.js';
import { walk } from '../walk.js';
import { Globals, isGlobalIdentifier, mapGlobalIdentifier, mapGlobalAccessor } from './global.js';
export type Sources = Record<string | symbol, QueryExpression>;

export type ConvertOptions = {
    /** Whether to convert LogicalExpressions to BinaryExpressions */
    convertLogical?: boolean;
};

export function convert(
    sources: Sources,
    expression: Expression<ExpressionTypeKey>,
    varsName?: string | symbol,
    globals?: Globals,
    args?: Serializable,
    options?: ConvertOptions,
): QueryExpression {
    return process(expression);

    function process(expression: Expression<ExpressionTypeKey>): QueryExpression {
        switch (expression.type) {
            case `ExternalExpression`:
                return processExternal(expression);
            case `Identifier`:
                return processIdentifier(expression);
            case `MemberExpression`:
                return processMemberExpression(expression);
            case `CallExpression`:
                return processCallExpression(expression);
            case `BinaryExpression`:
                return new BinaryExpression(
                    process(expression.left),
                    convertBinaryOperator(expression.operator),
                    process(expression.right),
                );
            case `LogicalExpression`:
                if (options?.convertLogical) {
                    return new BinaryExpression(
                        process(expression.left),
                        convertLogicalOperator(expression.operator),
                        process(expression.right),
                    );
                } else {
                    return new LogicalExpression(
                        process(expression.left),
                        convertLogicalOperator(expression.operator),
                        process(expression.right),
                    );
                }
            case `ConditionalExpression`: {
                const test = process(expression.test);
                const consequent = process(expression.consequent);
                const alternate = process(expression.alternate);
                return new TernaryExpression(test, consequent, alternate);
            }
            case `Literal`:
                return new Literal(expression.value);
            case `TemplateLiteral`: {
                // TODO
                if (expression.expressions.length > 0) {
                    throw new Error(`Template literals not fully supported`);
                }

                if (expression.quasis.length !== 1) {
                    throw new Error(`Expected exactly one quasi`);
                }

                if (expression.quasis[0].type !== `TemplateElement`) {
                    throw new Error(`Expected quasi to be a "TemplateElement". Got "${expression.quasis[0].type}"`);
                }

                return new Literal(expression.quasis[0].value.cooked);
            }
            case `UnaryExpression`:
                if (expression.operator !== `!`) {
                    throw new Error(`Unabry operator "${expression.operator}" not supported`);
                }
                return new UnaryExpression(expression.operator, process(expression.argument));
            default:
                throw new Error(`Unexpected expression type "${expression.type}" received`);
        }

        function convertLogicalOperator(operator: Operator): LogicalOperator {
            switch (operator) {
                case `&&`:
                case `||`:
                case `??`:
                    return operator;
                default:
                    throw new Error(`Operator "${operator}" not supported as a logical operator`);
            }
        }

        function convertBinaryOperator(operator: Operator): BinaryOperator {
            switch (operator) {
                case `===`:
                    return `==`;
                case `!==`:
                    return `!=`;
                case `<`:
                case `<=`:
                case `>`:
                case `>=`:
                case `+`:
                case `-`:
                case `*`:
                case `%`:
                case `&&`:
                case `||`:
                case `??`:
                    return operator;
                case `!`:
                case `==`:
                case `!=`:
                case `++`:
                case `+=`:
                case `--`:
                case `-=`:
                case `*=`:
                case `/`:
                case `/=`:
                case `**`:
                case `**=`:
                case `|`:
                case `|=`:
                case `||=`:
                case `~`:
                case `^`:
                case `^=`:
                case `&`:
                case `&=`:
                case `&&=`:                
                case `??=`:
                case `%=`:
                case `<<`:
                case `<<=`:                
                case `>>`:
                case `>>=`:
                case `>>>`:
                case `>>>=`:
                case `in`:
                    throw new Error(`Operator "${operator}" not supported`);
            }
        }
    }

    function processIdentifier(expression: Expression<`Identifier`>): QueryExpression {
        if (expression.name === `undefined`) {
            return new Literal(null);
        }

        const source = sources[expression.name];

        if (source !== undefined) {
            return source;
        }

        if (isGlobalIdentifier(expression, globals)) {
            const exp = mapGlobalIdentifier(expression, globals!, []);
            if (exp === undefined) {
                throw new Error(`Unable to map global expression`);
            }
        }

        // Since we will handle a vars member expression manually,
        //  we assume this is a direct access identifier, and so there
        //  is no path required
        if (expression.name === varsName) {
            return new VariableExpression([], args);
        }

        throw new Error(`No identifier "${String(expression.name)}" found (on sources or global)`);
    }

    function processExternal(expression: Expression<`ExternalExpression`>) {
        const path: string[] = [];
        walk(expression.expression, (exp) => {
            if (exp.type === `Property`) {
                return false;
            }

            if (exp.type === `Identifier`) {
                path.push(exp.name as string);
                return false;
            }
            if (exp.type === `Literal`) {
                path.push(String(exp.value));
                return false;
            }
            if (exp.type === `MemberExpression`) {
                return true;
            }
            throw new Error(`Unexpected expression type "${exp.type}"`);
        });
        return new VariableExpression(path.slice(1), args);
    }

    function processCallExpression(expression: Expression<`CallExpression`>): QueryExpression {
        const args = expression.arguments.map(process);

        if (expression.callee.type === `MemberExpression` && isGlobalIdentifier(expression.callee, globals)) {
            const exp = mapGlobalIdentifier(expression.callee, globals!, args);
            if (exp === undefined) {
                throw new Error(`Unable to map global expression`);
            }
            return exp;
        }

        const callee = process(expression.callee);

        if (callee.type instanceof FunctionType === false) {
            if (args.length !== 0) {
                throw new Error(`Received non function type as callee, but args were supplied`);
            }
            return callee;
        }

        return new CallExpression(
            callee.type.returnType,
            callee,
            new CallArguments(args),
        );
    }

    function processMemberExpression(expression: Expression<`MemberExpression`>): QueryExpression {
        if (isGlobalIdentifier(expression, globals)) {
            const exp = mapGlobalIdentifier(expression, globals!, []);
            if (exp === undefined) {
                throw new Error(`Unable to map global expression`);
            }
            return exp;
        }

        const source = process(expression.object);
        const name = readName(expression.property);

        if (typeof name === `symbol`) {
            throw new Error(`Unexpected symbol property name`);
        }

        switch (true) {
            case source instanceof Field:
            case source instanceof FieldIdentifier: {
                const type = source.type[name];
                if (type === undefined) {
                    throw new Error(`Unable to find identifier "${name}" on field "${source.name}"`);
                }

                if (source.type instanceof EntityType) {
                    const result = processAccess(source, name);
                    return result;
                }

                const exp = mapGlobalAccessor(source, name, [], globals);
                if (exp === undefined) {
                    throw new Error(`Unable to map MemberExpression to global`);
                }
                return exp;
            }
            case source instanceof BinaryExpression:
            case source instanceof LogicalExpression:
            case source instanceof TernaryExpression:
            case source instanceof UnaryExpression:
            case source instanceof Source: {
                const result = processAccess(source, name) as QueryExpression;
                return result;
            }
            case source instanceof GlobalIdentifier:
                // This should have been handled above?
                //  How would we apply a property to a global expression anyway?
                throw new Error(`Unexpected GlobalIdentifier`);
            case source instanceof CallExpression:
            case source instanceof Literal: {
                // Any time the source is a call expression we are going to
                //  be mapping onto a global accessor since we can never return
                //  an entity type from calls (or can we?)
                const exp = mapGlobalAccessor(source, name, [], globals);
                if (exp === undefined) {
                    throw new Error(`Unable to map MemberExpression to global`);
                }
                return exp;
            }
            default:
                throw new Error(`Unexpected expression type "${source.constructor.name}" received`);
        }
    }

    function processAccess(source: QueryExpression, name: string) {
        const type = source.type[name];
        if (type === undefined) {
            throw new Error(`Unable to find identifier "${name}" on source`);
        }

        if (source.type instanceof EntityType === false) {
            const src = source instanceof Source ?
                source.fieldSet.field :
                source;

            // Either a scalar or a union. In both cases we will
            //  be accessing a globally mapped accessor
            const exp = mapGlobalAccessor(src, name, [], globals);
            if (exp === undefined) {
                throw new Error(`Unable to map MemberExpression to global (Trying to map "${name}" to "${src.type.constructor.name}")`);
            }
            return exp;
        }

        switch (true) {
            case source instanceof LinkedEntitySource: {
                const field = source.fieldSet.find(name);
                if (field === undefined) {
                    throw new Error(`Unable to find identifier "${name}" on source`);
                }

                const src = field.source instanceof Boundary ?
                    field.source.expression :
                    field.source;

                // Scalars
                if (src instanceof FieldIdentifier) {
                    return new FieldIdentifier(
                        new LinkedEntitySource(
                            source.linked,
                            src.source,
                            source.clause,
                        ),
                        field.name.name,
                        field.type,
                    );
                }

                if (src instanceof EntitySource) {
                    return new LinkedEntitySource(
                        source,
                        src,
                        source.clause,
                    );
                }

                if (src instanceof LinkedEntitySource) {
                    // TODO: Test this
                    return new LinkedEntitySource(
                        source,
                        src.source,
                        src.clause,
                    );
                }

                throw new Error(`Unexpected field source type "${src.constructor.name}" received`);
            }
            case source instanceof Source: {
                const field = source.fieldSet.find(name);
                if (field === undefined) {
                    throw new Error(`Unable to find identifier "${name}" on source`);
                }
                return field.source;
            }
            case source instanceof Field: {
                return processAccess(source.source, name);
            }
            case source instanceof BinaryExpression:
            case source instanceof LogicalExpression:
            case source instanceof TernaryExpression:
            case source instanceof UnaryExpression:
                // TODO: We would need to return multiple values from this surely?
                throw new Error(`not implemented`);
            default:
                throw new Error(`Unexpected Expression type received "${source.constructor.name}"`);
        }
    }
}

