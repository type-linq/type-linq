// TODO: Better name
import { readName } from './util';
import { ExpressionType, Expression as QueryExpression } from '../tree/expression';
import { SourceExpression } from '../tree/source';
import { Expression, ExpressionTypeKey, Operator } from '../type';
import { walk } from '../walk';
import { Globals, isGlobalIdentifier, mapGlobal, mapGlobalAccessor } from './global';
import { memberExpressionRoot } from '../../../sqlite/src/compile/util';
import { CallExpression } from '../tree/call';
import { GlobalExpression } from '../tree/global';
import { VariableExpression } from '../tree/variable';
import { UnaryExpression } from '../tree/unary';
import { Literal } from '../tree/literal';
import { BinaryExpression, BinaryOperator, LogicalExpression, LogicalOperator } from '../tree/binary';
import { TernaryExpression } from '../tree/ternary';

export type Sources = Record<string | symbol, QueryExpression<ExpressionType>>;

export function convert(
    sources: Sources,
    expression: Expression<ExpressionTypeKey>,
    varsName?: string | symbol,
    globals?: Globals,
    args?: unknown,
): { expression: QueryExpression<ExpressionType>, linkChains: Record<string, SourceExpression[]> } {
    const linkChains: Record<string, SourceExpression[]> = {};

    return {
        linkChains,
        expression: process(expression),
    }

    function process(expression: Expression<ExpressionTypeKey>): QueryExpression<ExpressionType> {
        switch (expression.type) {
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
        const expressionSource = memberExpressionRoot(expression);
        if (expressionSource.type === `Identifier`&& expressionSource.name === varsName) {
            const path: string[] = [];
            walk(expression, (exp) => {
                if (exp.type === `Identifier`) {
                    return false;
                }
                if (exp.type === `MemberExpression`) {
                    const name = readName(exp.property);
                    path.push(name as string);
                }
                throw new Error(`Unexpected expression type "${expression.type}"`);
            });
            return new VariableExpression(path, args);
        }

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

        // TODO: Should we be handling Binary Logical and Ternary expressions here?
        //  If so we need 

        if (source instanceof SourceExpression === false) {
            throw new Error(`Unexpected expression type. Expected SourceExpression got "${source.expressionType}"`);
        }

        if (Array.isArray(source.columns) === false) {
            const exp = mapGlobalAccessor(source.columns, name, [], globals);
            if (exp === undefined) {
                throw new Error(`Unable to map MemberExpression to global`);
            }
            return exp;
        }

        // We have a SourceExpression
        const sourceColumn = source.columns.find(
            (column) => column.name === name
        );

        if (sourceColumn === undefined) {
            throw new Error(`Unable to find column "${name}" on "${source.name}"`);
        }

        if (sourceColumn.expression instanceof SourceExpression) {
            if (sourceColumn.expression.resource !== source.resource) {
                linkChains[source.resource] = linkChains[source.resource] || [];
                linkChains[source.resource].push(sourceColumn.expression);
            }
        }

        return sourceColumn.expression;
    }
}