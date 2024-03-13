// TODO: Better name
import { readName } from './util';
import { ExpressionType, Expression as QueryExpression } from '../tree/expression';
import { SourceExpression } from '../tree/source';
import { Expression, ExpressionTypeKey, Operator, Serializable } from '../type';
import { walk } from '../walk';
import { Globals, isGlobalIdentifier, mapGlobal, mapGlobalAccessor } from './global';
import { CallExpression } from '../tree/call';
import { GlobalExpression } from '../tree/global';
import { VariableExpression } from '../tree/variable';
import { UnaryExpression } from '../tree/unary';
import { Literal } from '../tree/literal';
import { BinaryExpression, BinaryOperator, LogicalExpression, LogicalOperator } from '../tree/binary';
import { TernaryExpression } from '../tree/ternary';
import { CaseBlock, CaseExpression } from '../tree/case';
import { Column } from '../tree/column';
import { JoinExpression } from '../tree/join';
import { SelectExpression } from '../tree/select';
import { asArray } from '../tree/util';
import { UnionType } from '../tree/type';

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
            if (exp.type === `Identifier`) {
                return false;
            }
            if (exp.type === `Literal`) {
                return false;
            }
            if (exp.type === `MemberExpression`) {
                const name = readName(exp.property);
                path.push(name as string);
            }
            throw new Error(`Unexpected expression type "${exp.type}"`);
        });
        return new VariableExpression(path, args);
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

function fetchSources(expression: QueryExpression<ExpressionType>): SourceExpression[] {
    switch (expression.expressionType) {
        case `BinaryExpression`: {
            // TODO: Need to add brackets in the correct places
            const binary = expression as BinaryExpression;
            const sources = [
                ...fetchSources(binary.left),
                ...fetchSources(binary.right),
            ];
            return sources;
        }
        case `LogicalExpression`: {
            const logical = expression as LogicalExpression;
            const sources = [
                ...fetchSources(logical.left),
                ...fetchSources(logical.right),
            ];
            return sources;
        }
        case `VariableExpression`: {
            return [];
        }
        case `CallExpression`: {
            const call = expression as CallExpression;
            const sources = [
                ...fetchSources(call.callee),
                ...call.arguments.map(fetchSources).flat(),
            ];
            return sources;
        }
        case `CaseBlock`: {
            const block = expression as CaseBlock;
            const sources = [
                ...fetchSources(block.test),
                ...fetchSources(block.consequent),
            ];
            return sources;
        }
        case  `CaseExpression`: {
            const exp = expression as CaseExpression;
            const sources = [
                ...exp.when.map(fetchSources).flat(),
                ...fetchSources(exp.alternate),
            ];
            return sources;
        }
        case `Column`: {
            const column = expression as Column;
            const sources = fetchSources(column.expression);
            return sources;
        }
        case `GlobalExpression`:
            return [];
        case `Identifier`: 
            return [];
        case `JoinExpression`: {
            const join = expression as JoinExpression;

            const clauses = join.join.map(
                (clause) => [...fetchSources(clause.left), ...fetchSources(clause.right)]
            ).flat();

            const sources = [
                ...fetchSources(join.source),
                ...clauses,
            ];
            return sources;
        }
        case `Literal`:
            return [];
        case `SelectExpression`: {
            const exp = expression as SelectExpression;
            const sources = [
                ...asArray(exp.columns).map(
                    (column) => fetchSources(column.expression)
                ).flat(),
                ...exp.join.map(fetchSources).flat(),
                ...fetchSources(exp.source),
            ];

            if (exp.where) {
                sources.push(...fetchSources(exp.where));
            }

            return sources;
        }
        case `SourceExpression`: {
            const source = expression as SourceExpression;
            return [source];
        }
        case `TernaryExpression`: {
            const exp = expression as TernaryExpression;
            const sources = [
                ...fetchSources(exp.test),
                ...fetchSources(exp.consequent),
                ...fetchSources(exp.alternate),
            ];
            return sources;
        }
        case `UnaryExpression`: {
            const unary = expression as UnaryExpression;
            return fetchSources(unary.expression);
        }
        default:
            throw new Error(`Unkown expression type "${expression.expressionType}" received`);
    }

}
