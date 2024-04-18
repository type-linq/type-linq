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
    FieldIdentifier,
    FunctionType,
    CallArguments,
    Expression,
    Type,
    UnknownType,
    Walker,
    LinkedEntity,
} from '@type-linq/query-tree';
import { readName } from './util.js';
import { Expression as AstExpression, ExpressionTypeKey, Operator, Serializable } from '../type.js';
import { walk } from '../walk.js';
import { isGlobalIdentifier, mapGlobalIdentifier, mapGlobalAccessor } from './global.js';
import { QueryableEmbedded } from '../queryable/queryable.js';
import { ExpressionSource } from '../queryable/util.js';
import { QueryProvider } from '../query-provider.js';

export type Sources = Record<string | symbol, ExpressionSource>;

export type ConvertOptions = {
    /** Whether to convert LogicalExpressions to BinaryExpressions */
    convertLogical?: boolean;
};

// We need to make sure that we never return one of these... we always need to make sure
//  it's a Queryable, and then return the Queryable expression.....
class EmbeddedQueryExpression<TValue> extends Expression {
    readonly type: Type = new UnknownType();
    readonly value: TValue;

    constructor(value: TValue) {
        super();
        this.value = value;
    }

    isEqual(expression?: Expression): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof EmbeddedQueryExpression === false) {
            return false;
        }

        return this.value === expression.value;
    }

    rebuild(): QueryExpression {
        return this;
    }

    *walk() { }
}

export function convert(
    sources: Sources,
    expression: AstExpression<ExpressionTypeKey>,
    provider: QueryProvider,
    varsName?: string | symbol,
    args?: Serializable,
    options?: ConvertOptions,
): QueryExpression {
    // TODO: Wrape embeddedentity expressions as subsources if necessary!s

    const exp = process(expression);
    const result = Walker.map(exp, (exp) => {
        if (exp instanceof EmbeddedQueryExpression === false) {
            return exp;
        }

        if (exp.value instanceof QueryableEmbedded === false) {
            throw new Error(`Exprected any remaining DirectExpressions to only contain Queryables directly`);
        }

        // TODO: Here.....we need the correct type!
        // We are getting the type returned by the select expression... but we actually
        //  need an EntitySet....
        //      Or maybe we just need to handle it differently in compile?

        return exp.value.expression;
    });

    return result;

    function process(expression: AstExpression<ExpressionTypeKey>): QueryExpression {
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

    function processIdentifier(expression: AstExpression<`Identifier`>): QueryExpression {
        if (expression.name === `undefined`) {
            return new Literal(null);
        }

        const source = sources[expression.name];

        if (source !== undefined) {
            if (source instanceof QueryableEmbedded) {
                return new EmbeddedQueryExpression(source);
            }
            return source;
        }

        if (isGlobalIdentifier(expression, provider.globals)) {
            const exp = mapGlobalIdentifier(expression, provider.globals);
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

    function processExternal(expression: AstExpression<`ExternalExpression`>) {
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

    function processCallExpression(expression: AstExpression<`CallExpression`>): QueryExpression {
        const callee = process(expression.callee);

        if (callee instanceof EmbeddedQueryExpression) {
            if (typeof callee.value !== `function`) {
                throw new Error(`callee is not a function`);
            }

            // We always assume thet any direct expression stuff accepts all expressions to it's call
            const result = callee.value(...expression.arguments, args);

            if (result instanceof Expression) {
                return result;
            } else {
                return new EmbeddedQueryExpression(result);
            }
        }

        const callArgs = expression.arguments.map(process);

        if (expression.callee.type === `MemberExpression` && isGlobalIdentifier(expression.callee, provider.globals)) {
            const exp = mapGlobalIdentifier(expression.callee, provider.globals, callArgs);
            if (exp === undefined) {
                throw new Error(`Unable to map global expression`);
            }
            return exp;
        }

        if (callee.type instanceof FunctionType === false) {
            if (callArgs.length !== 0) {
                throw new Error(`Received non function type as callee, but args were supplied`);
            }
            return callee;
        }

        return new CallExpression(
            callee.type.returnType,
            callee,
            new CallArguments(callArgs),
        );
    }

    function processMemberExpression(expression: AstExpression<`MemberExpression`>): QueryExpression {
        if (isGlobalIdentifier(expression, provider.globals)) {
            const exp = mapGlobalIdentifier(expression, provider.globals);
            if (exp === undefined) {
                throw new Error(`Unable to map global expression`);
            }
            return exp;
        }

        // Not that we've sorted out the field identifiers and fields,
        //  what changes do we need to make here?

        const source = process(expression.object);
        const name = readName(expression.property);

        if (typeof name === `symbol`) {
            throw new Error(`Unexpected symbol property name`);
        }

        if (source instanceof EmbeddedQueryExpression) {
            if (source.value[name] instanceof Expression) {
                return source.value[name];
            }

            if (typeof source.value[name] === `function`) {
                return new EmbeddedQueryExpression(
                    (...args: unknown[]) => source.value[name](...args)
                );
            }

            return new EmbeddedQueryExpression(
                source.value[name]
            );
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

                const exp = mapGlobalAccessor(source, name, [], provider.globals);
                if (exp === undefined) {
                    throw new Error(`Unable to map MemberExpression to global`);
                }
                return exp;
            }
            case source instanceof BinaryExpression:
            case source instanceof LogicalExpression:
            case source instanceof TernaryExpression:
            case source instanceof UnaryExpression:
                // TODO: We would need to return multiple values from this surely?
                throw new Error(`not implemented`);
            case source instanceof Source: {
                if (source.type instanceof EntityType === false) {
                    const field = source.fieldSet.field;
                    const exp = mapGlobalAccessor(field, name, [], provider.globals);
                    if (exp === undefined) {
                        throw new Error(`Unable to map MemberExpression to global (Trying to map "${name}" to "${field.type.constructor.name}")`);
                    }
                    return exp;
                }

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
                const exp = mapGlobalAccessor(source, name, [], provider.globals);
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
        if (source.type instanceof EntityType === false) {
            throw new Error(`processAccess must be called on an EntityType`);
        }

        const type = source.type[name];
        if (type === undefined) {
            throw new Error(`Unable to find identifier "${name}" on source`);
        }

        switch (true) {
            case source instanceof Field:
                return processAccess(source.expression, name);
            case source instanceof Source: {
                const field = source.fieldSet.find(name);

                if (field === undefined) {
                    throw new Error(`Unable to find identifier "${name}" on source`);
                }

                if (field.expression instanceof LinkedEntity && field.expression.set) {
                    const embedded = new QueryableEmbedded(provider, field.expression);
                    return new EmbeddedQueryExpression(embedded);
                }

                return field.expression;
            }
            case source instanceof FieldIdentifier: {
                const entityField = source.entity.fieldSet.find(source.name);
                if (!entityField) {
                    throw new Error(`Unable to find entity field "${source.name}" on defined source`);
                }

                return processAccess(entityField.expression, name);
            }
            default:
                throw new Error(`Unexpected source type "${source.constructor.name}" received`);
        }
    }
}

