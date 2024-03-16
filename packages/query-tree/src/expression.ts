export type ExpressionType = `BinaryExpression` | `LogicalExpression` | `VariableExpression` |
    `CallExpression` | `CaseExpression` | `CaseBlock` | `GlobalIdentifier` | `EntityIdentifier` |
    `FieldIdentifier` | `JoinExpression` | `JoinClause` | `Literal` | `SelectExpression` |
    `TernaryExpression` | `UnaryExpression` | `FromExpression` | `WhereExpression` |
    `GroupExpression` | `Alias` | `AliasSource`;

export type SelectExpressionType = `SelectExpression` | `JoinExpression`;
export type SourceExpressionType = `FromExpression` | `SelectExpression` | `WhereExpression` | `JoinExpression` | `GroupExpression` | `AliasSource`;
export type IdentifierExpressionType = `EntityIdentifier` | `FieldIdentifier` | `GlobalIdentifier`;

import { SourceExpression } from './source/source';
import { FromExpression } from './source/from';
import { SelectExpression } from './source/select';
import { WhereExpression } from './source/where';
import { JoinClause, JoinExpression } from './source/join';

import { Type, isEqual as isTypeEqual } from './type';
import { BinaryExpression, LogicalExpression } from './binary';
import { VariableExpression } from './variable';
import { CallExpression } from './call';
import { CaseBlock, CaseExpression } from './case';
import { Alias, EntityIdentifier, FieldIdentifier, GlobalIdentifier } from './identifier';
import { Literal } from './literal';
import { TernaryExpression } from './ternary';
import { UnaryExpression } from './unary';
import { AliasSource } from './source/alias';

export abstract class Expression<TType extends string = ExpressionType> {
    abstract expressionType: TType;
    abstract type: Type;
    
    isEqual(expression: Expression<TType>, ...ignore: string[]): boolean {
        if (ignore.includes(`type`) === false && isTypeEqual(this.type, expression.type) === false) {
            return false;
        }

        for (const [name, value] of Object.entries(expression)) {
            if (name === `type`) {
                continue;
            }

            if (ignore.includes(name)) {
                continue;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const thisValue = (this as any)[name];
            if (areEqual(thisValue, value) === false) {
                return false;
            }
        }

        return true;

        function areEqual(thisValue: unknown, value: unknown) {
            if (Array.isArray(thisValue) !== Array.isArray(value)) {
                return false;
            }

            if (Array.isArray(thisValue) && Array.isArray(value)) {
                if (thisValue.length !== value.length) {
                    return false;
                }
                for (let index = 0; index < thisValue.length; index++) {
                    const element1 = thisValue[index];
                    const element2 = value[index];

                    if (areEqual(element1, element2) === false) {
                        return false;
                    }
                }
            }

            if (value instanceof Expression && thisValue instanceof Expression) {
                return value.isEqual(thisValue);
            }

            return thisValue === value;
        }
    }

    static walk(expression: Expression<string>, visitor: (expression: Expression<string>) => void | false) {
        if (visitor(expression) === false) {
            return false;
        }

        for (const value of Object.values(expression)) {
            if (value instanceof Expression) {
                if (Expression.walk(value, visitor) === false) {
                    return false;
                }
            }
        }

        return true;
    }

    static walkMutate(expression: Expression, visitor: (expression: Expression) => Expression): Expression {
        switch (true) {
            case expression instanceof BinaryExpression: {
                const left = Expression.walkMutate(expression.left, visitor);
                const right = Expression.walkMutate(expression.left, visitor);

                if (left === expression.left && right === expression.right) {
                    return visitor(expression);
                }

                return new BinaryExpression(left, expression.operator, right);
            }
            case expression instanceof LogicalExpression: {
                const left = Expression.walkMutate(expression.left, visitor);
                const right = Expression.walkMutate(expression.left, visitor);

                if (left === expression.left && right === expression.right) {
                    return visitor(expression);
                }

                return new LogicalExpression(left, expression.operator, right);
            }
            case expression instanceof CallExpression: {
                const callee = Expression.walkMutate(expression.callee, visitor);
                const args = expression.arguments.map(
                    (exp) => Expression.walkMutate(exp, visitor)
                );

                if (callee === expression.callee && args.every((a, i) => a.isEqual(expression.arguments[i]))) {
                    return visitor(expression);
                }

                return new CallExpression(expression.type, callee, args);
            }
            case expression instanceof CaseExpression: {
                const alternate = Expression.walkMutate(expression.alternate, visitor);
                const when = expression.when.map(
                    (exp) => Expression.walkMutate(exp, visitor)
                );

                if (alternate === expression.alternate && when.every((a, i) => a.isEqual(expression.when[i]))) {
                    return visitor(expression);
                }

                return new CaseExpression(when as CaseBlock[], alternate);
            }
            case expression instanceof CaseBlock: {
                const test = Expression.walkMutate(expression.test, visitor);
                const consequent = Expression.walkMutate(expression.consequent, visitor);

                if (test === expression.test && consequent === expression.consequent) {
                    return visitor(expression);
                }

                return new CaseBlock(test, consequent);
            }
            case expression instanceof FieldIdentifier: {
                const source = Expression.walkMutate(expression.source, visitor);
                if (source === expression) {
                    return visitor(expression);
                }
                return new FieldIdentifier(source as SourceExpression, expression.name);
            }
            case expression instanceof JoinExpression: {
                const source = Expression.walkMutate(expression.source, visitor);
                const joined = Expression.walkMutate(expression.joined, visitor);
                const join = expression.join.map(
                    (exp) => Expression.walkMutate(exp, visitor) as JoinClause
                );

                if (source === expression.source && joined === expression.joined && join.every((a, i) => a.isEqual(expression.join[i]))) {
                    return visitor(expression);
                }

                return new JoinExpression(source as SourceExpression, joined as SourceExpression, join);
            }
            case expression instanceof JoinClause: {
                const left = Expression.walkMutate(expression.left, visitor);
                const right = Expression.walkMutate(expression.left, visitor);

                if (left === expression.left && right === expression.right) {
                    return visitor(expression);
                }

                return new JoinClause(left, right);
            }
            case expression instanceof SelectExpression: {
                const source = Expression.walkMutate(expression.source, visitor);
                if (source === expression.source) {
                    return visitor(expression);
                }
                return new SelectExpression(source as SourceExpression, expression.fields);
            }
            case expression instanceof TernaryExpression: {
                const test = Expression.walkMutate(expression.test, visitor);
                const consequent = Expression.walkMutate(expression.consequent, visitor);
                const alternate = Expression.walkMutate(expression.alternate, visitor);

                if (test === expression.test && consequent === expression.consequent && alternate === expression.alternate) {
                    return visitor(expression);
                }

                return new TernaryExpression(test, consequent, alternate);
            }
            case expression instanceof UnaryExpression: {
                const exp = Expression.walkMutate(expression.expression, visitor);
                if (exp === expression.expression) {
                    return visitor(expression);
                }
                return new UnaryExpression(expression.operator, exp);
            }
            case expression instanceof FromExpression: {
                return visitor(expression);
            }
            case expression instanceof WhereExpression: {
                const source = Expression.walkMutate(expression.source, visitor);
                const clause = Expression.walkMutate(expression.clause, visitor);
                if (source === expression.source && clause === expression.clause) {
                    return visitor(expression);
                }
                return new WhereExpression(source as SourceExpression, clause as LogicalExpression);
            }
            case expression instanceof Alias: {
                const exp = Expression.walkMutate(expression.expression, visitor);
                if (exp === expression.expression) {
                    return visitor(expression);
                }
                return new Alias(exp, expression.alias);
            }
            case expression instanceof AliasSource: {
                const source = Expression.walkMutate(expression.source, visitor);
                if (source === expression.source) {
                    return visitor(expression);
                }
                return new Alias(source, expression.alias);
            }
            case expression instanceof VariableExpression:
            case expression instanceof GlobalIdentifier:
            case expression instanceof EntityIdentifier:
            case expression instanceof Literal:
                return visitor(expression);
            default:
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                throw new Error(`Unknown Expression "${(expression as any).constructor.name}" received`);
        }
    }

    /** Walks through the expression along the main branch */
    static walkBranch(expression: SourceExpression, visitor: (expression: Expression<string>) => void | false) {
        if (visitor(expression) === false){ 
            return false;
        }

        if (expression.source) {
            if (Expression.walk(expression.source, visitor) === false) {
                return false;
            }
        }

        return true;
    }

    /** Walks through the expression along the main branch */
    static walkBranches(expression: Expression, visitor: (expression: Expression<string>) => void | false) {
        if (expression instanceof SourceExpression) {
            return Expression.walkBranch(expression, visitor);
        }

        for (const value of Object.values(expression)) {
            if (value instanceof Expression) {
                if (Expression.walkBranches(value, visitor) === false) {
                    return false;
                }
            }
        }

        return true;
    }


    /** Walks through the expression and returns the expression found when visitor returns true */
    static walkFind(expression: Expression<string>, visitor: (expression: Expression<string>) => boolean): Expression<string> | undefined {
        if (visitor(expression)) {
            return expression;
        }

        for (const value of Object.values(expression)) {
            if (value instanceof Expression) {
                const result = Expression.walkFind(value, visitor);
                if (result) {
                    return result;
                }
            }
        }

        return undefined;
    }

    /** Walks through the expression along the main branch, searching for the desired expression */
    static walkBranchFind(expression: SourceExpression, visitor: (expression: SourceExpression) => boolean): SourceExpression | undefined {
        if (visitor(expression)) {
            return expression;
        }

        if (expression.source) {
            return Expression.walkBranchFind(expression.source, visitor);
        }

        return undefined;
    }

    static walkBranchMutate(expression: SourceExpression, visitor: (expression: SourceExpression) => SourceExpression): SourceExpression {
        if (!expression.source) {
            return visitor(expression);
        }

        const result = Expression.walkBranchMutate(expression.source, visitor);
        if (result === expression.source) {
            return visitor(expression);
        }

        // We have changed something
        return visitor(
            rebuildWithSource(
                expression,
                result,
            )
        );
    }

    static source(expression: SourceExpression): FromExpression {
        if (expression.source) {
            return Expression.source(expression.source);
        } else {
            return expression as FromExpression;
        }
    }

    static sources(expression: Expression): FromExpression[] {
        const sources: FromExpression[] = [];

        Expression.walk(expression, (exp) => {
            if (exp instanceof FromExpression) {
                sources.push(exp);
            }
        });

        return sources;
    }
}

function rebuildWithSource(expression: SourceExpression, source: SourceExpression) {
    switch (true) {
        case expression instanceof SelectExpression:
            return new SelectExpression(source, expression.fields);
        case expression instanceof WhereExpression:
            return new WhereExpression(source, expression.clause);
        case expression instanceof JoinExpression:
            return new JoinExpression(source, expression.joined, expression.join);
        case expression instanceof FromExpression:
            throw new Error(`From does not have a source and as such cannot be rebuilt with one`);
        default:
            throw new Error(`Unknown SourceExpression "${expression.constructor.name}" received`);
    }
}