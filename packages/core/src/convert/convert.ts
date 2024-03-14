// TODO: Better name
import { fetchSources, readName } from './util';
import { Expression, ExpressionTypeKey, Operator, Serializable } from '../type';
import { walk } from '../walk';
import { Globals, isGlobalIdentifier, mapGlobal, mapGlobalAccessor } from './global';
import {
    BinaryExpression,
    BinaryOperator,
    CallExpression,
    ExpressionType,
    GlobalExpression,
    Literal,
    LogicalExpression,
    LogicalOperator,
    Expression as QueryExpression,
    SelectExpression,
    SourceExpression,
    TernaryExpression,
    UnaryExpression,
    UnionType,
    VariableExpression,
    asArray
} from '../tree/index';
export type Sources = Record<string | symbol, QueryExpression<ExpressionType>>;

export function convert(
    sources: Sources,
    expression: Expression<ExpressionTypeKey>,
    varsName?: string | symbol,
    globals?: Globals,
    args?: Serializable,
): { expression: QueryExpression<ExpressionType>, linkMap: Map<SourceExpression, SourceExpression[]> } {
    // TODO: We need some additional information here...
    //  We need to figur out the way the 2 sources map together....
    const linkMap = new Map<SourceExpression, SourceExpression[]>();

    return {
        linkMap,
        expression: process(expression),
    }

    function process(expression: Expression<ExpressionTypeKey>): QueryExpression<ExpressionType> {
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
                return new LogicalExpression(
                    process(expression.left),
                    convertLogicalOperator(expression.operator),
                    process(expression.right),
                );
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

    function processIdentifier(expression: Expression<`Identifier`>): QueryExpression<ExpressionType> {
        if (expression.name === `undefined`) {
            return new Literal(null);
        }

        const source = sources[expression.name];

        if (source !== undefined) {
            return source;
        }

        if (isGlobalIdentifier(expression, globals)) {
            const exp = mapGlobal(expression, globals!);
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

    function processCallExpression(expression: Expression<`CallExpression`>): QueryExpression<ExpressionType> {
        if (expression.callee.type !== `MemberExpression`) {
            throw new Error(`Expected CallExpression to always act on a MemberExpression`);
        }

        const name = readName(expression.callee.property);
        const callee = process(expression.callee.object);
        const args = expression.arguments.map(process);

        const exp = mapGlobalAccessor(callee, name, args, globals);

        if (exp === undefined) {
            throw new Error(`Unable to map global expression "${String(name)}" onto type ${callee.type.name}`);
        }
        return exp;
    }

    function processMemberExpression(expression: Expression<`MemberExpression`>): QueryExpression<ExpressionType> {
        const source = process(expression.object);
        const name = readName(expression.property);

        if (typeof name === `symbol`) {
            throw new Error(`Unexpected symbol property name`);
        }

        if (source instanceof GlobalExpression) {
            // This should have been handled above?
            //  How would we apply a property to a global expression anyway?
            throw new Error(`Unexpected GloblExpression`);
        }

        // Any time the source is a call expression we are going to
        //  be mapping onto a global accessor since we can never return
        //  an entity type from calls (or can we?)
        if (source instanceof CallExpression) {
            const exp = mapGlobalAccessor(source, name, [], globals);
            if (exp === undefined) {
                throw new Error(`Unable to map MemberExpression to global`);
            }
            return exp;
        }

        const sources = fetchSources(source);
        const result = processAccess(source, name);

        if (result instanceof SourceExpression === true) {
            for (const source of sources) {
                if (result.name !== source.name) {
                    if (linkMap.has(source)) {
                        linkMap.get(source)!.push(result);
                    } else {
                        linkMap.set(source, [result]);
                    }
                }
            }
        }

        return result;
    }

    function processAccess(source: QueryExpression<ExpressionType>, name: string) {
        if (source instanceof SourceExpression || source instanceof SelectExpression) {
            const sourceColumn = asArray(source.columns).find(
                (column) => column.name === name
            );

            if (sourceColumn) {
                return sourceColumn.expression;
            }
        }

        if(source.type instanceof UnionType) {
            // TODO: Implament union types.
            //  They will need to make sure the accessor is valid for all branches.
            throw new Error(`Accessors onto union types are not currently supported`);
        }

        if (name in source.type === false) {
            throw new Error(`Unable to find identifier "${name}" on source`);
        }

        const exp = mapGlobalAccessor(source, name, [], globals);
        if (exp === undefined) {
            throw new Error(`Unable to map MemberExpression to global ("${name}")`);
        }
        return exp;
    }
}

