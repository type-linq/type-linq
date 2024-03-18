import { BinaryExpression, LogicalExpression } from './binary.js';
import { CallExpression } from './call.js';
import { CaseBlock, CaseExpression } from './case.js';
import { Expression } from './expression.js';
import { Alias, EntityIdentifier, FieldIdentifier, GlobalIdentifier } from './identifier.js';
import { Literal } from './literal.js';
import { FromExpression } from './source/from.js';
import { JoinClause, JoinExpression } from './source/join.js';
import { SelectExpression } from './source/select.js';
import { SourceExpression } from './source/source.js';
import { WhereExpression } from './source/where.js';
import { TernaryExpression } from './ternary.js';
import { UnaryExpression } from './unary.js';
import { VariableExpression } from './variable.js';

export class Walker {
    static walk = walk;
    static collect = collect;
    static collectBranch = collectBranch;
    static walkMutate = walkMutate;
    static walkBranch = walkBranch;
    static walkBranches = walkBranches;
    static walkFind = walkFind;
    static walkBranchFind = walkBranchFind;
    static walkBranchMutate = walkBranchMutate;
    static source = source;
    static sources = sources;
    static fieldSource = fieldSource;
}

function walk(expression: Expression<string>, visitor: (expression: Expression<string>) => void | false | true) {
    if (visitor(expression) === false) {
        return false;
    }

    for (const value of Object.values(expression)) {
        if (value instanceof Expression) {
            if (walk(value, visitor) === false) {
                return false;
            }
        }
    }

    return true;
}

function collect(expression: Expression<string>, visitor: (expression: Expression<string>) => void | true): Expression<string>[] {
    const result: Expression<string>[] = [];

    for (const value of Object.values(expression)) {
        if (value instanceof Expression) {
            const collected = collect(value, visitor);
            result.push(...collected);
        }
    }

    if (visitor(expression) === true) {
        result.push(expression);
    }

    return result;
}

function collectBranch(expression: SourceExpression, visitor: (expression: SourceExpression) => boolean): SourceExpression[] {
    const result: SourceExpression[] = [];

    if (expression.source) {
        result.push(...collectBranch(expression.source, visitor));
    }

    if (visitor(expression) === true) {
        result.push(expression);
    }

    return result;
}

function walkMutate(expression: Expression, visitor: (expression: Expression, depth: number) => Expression, depth = 0): Expression {
    switch (true) {
        case expression instanceof BinaryExpression: {
            const left = walkMutate(expression.left, visitor, depth + 1);
            const right = walkMutate(expression.right, visitor, depth + 1);

            if (left === expression.left && right === expression.right) {
                return visitor(expression, depth);
            }

            return visitor(new BinaryExpression(left, expression.operator, right), depth);
        }
        case expression instanceof LogicalExpression: {
            const left = walkMutate(expression.left, visitor, depth + 1);
            const right = walkMutate(expression.right, visitor, depth + 1);

            if (left === expression.left && right === expression.right) {
                return visitor(expression, depth);
            }

            return visitor(new LogicalExpression(left, expression.operator, right), depth);
        }
        case expression instanceof CallExpression: {
            const callee = walkMutate(expression.callee, visitor, depth + 1);
            const args = expression.arguments.map(
                (exp) => walkMutate(exp, visitor, depth + 1)
            );

            if (callee === expression.callee && args.every((a, i) => a.isEqual(expression.arguments[i]))) {
                return visitor(expression, depth);
            }

            return visitor(new CallExpression(expression.type, callee, args), depth);
        }
        case expression instanceof CaseExpression: {
            const alternate = walkMutate(expression.alternate, visitor, depth + 1);
            const when = expression.when.map(
                (exp) => walkMutate(exp, visitor, depth + 1)
            );

            if (alternate === expression.alternate && when.every((a, i) => a.isEqual(expression.when[i]))) {
                return visitor(expression, depth);
            }

            return visitor(new CaseExpression(when as CaseBlock[], alternate), depth);
        }
        case expression instanceof CaseBlock: {
            const test = walkMutate(expression.test, visitor, depth + 1);
            const consequent = walkMutate(expression.consequent, visitor, depth + 1);

            if (test === expression.test && consequent === expression.consequent) {
                return visitor(expression, depth);
            }

            return visitor(new CaseBlock(test, consequent), depth);
        }
        case expression instanceof FieldIdentifier: {
            const source = walkMutate(expression.source, visitor, depth + 1);
            if (source === expression) {
                return visitor(expression, depth);
            }
            return visitor(
                new FieldIdentifier(
                    source as SourceExpression,
                    expression.name,
                    undefined,
                    expression.implicitJoins,
                ),
                depth,
            );
        }
        case expression instanceof JoinExpression: {
            const source = walkMutate(expression.source, visitor, depth + 1);
            const joined = walkMutate(expression.joined, visitor, depth + 1);
            const join = expression.join.map(
                (exp) => walkMutate(exp, visitor, depth + 1) as JoinClause
            );

            if (source === expression.source && joined === expression.joined && join.every((a, i) => a.isEqual(expression.join[i]))) {
                return visitor(expression, depth);
            }

            return visitor(new JoinExpression(source as SourceExpression, joined as SourceExpression, join), depth);
        }
        case expression instanceof JoinClause: {
            const left = walkMutate(expression.left, visitor, depth + 1);
            const right = walkMutate(expression.left, visitor, depth + 1);

            if (left === expression.left && right === expression.right) {
                return visitor(expression, depth);
            }

            return visitor(new JoinClause(left, right), depth);
        }
        case expression instanceof SelectExpression: {
            const source = walkMutate(expression.source, visitor, depth + 1);
            if (source === expression.source) {
                return visitor(expression, depth);
            }
            return visitor(new SelectExpression(source as SourceExpression, expression.fields), depth);
        }
        case expression instanceof TernaryExpression: {
            const test = walkMutate(expression.test, visitor, depth + 1);
            const consequent = walkMutate(expression.consequent, visitor, depth + 1);
            const alternate = walkMutate(expression.alternate, visitor, depth + 1);

            if (test === expression.test && consequent === expression.consequent && alternate === expression.alternate) {
                return visitor(expression, depth);
            }

            return visitor(new TernaryExpression(test, consequent, alternate), depth);
        }
        case expression instanceof UnaryExpression: {
            const exp = walkMutate(expression.expression, visitor, depth + 1);
            if (exp === expression.expression) {
                return visitor(expression, depth);
            }
            return visitor(new UnaryExpression(expression.operator, exp), depth);
        }
        case expression instanceof FromExpression: {
            return visitor(expression, depth);
        }
        case expression instanceof WhereExpression: {
            const source = walkMutate(expression.source, visitor, depth + 1);
            const clause = walkMutate(expression.clause, visitor, depth + 1);
            if (source === expression.source && clause === expression.clause) {
                return visitor(expression, depth);
            }
            return visitor(new WhereExpression(source as SourceExpression, clause as LogicalExpression), depth);
        }
        case expression instanceof Alias: {
            const exp = walkMutate(expression.expression, visitor, depth + 1);
            if (exp === expression.expression) {
                return visitor(expression, depth);
            }
            return visitor(new Alias(exp, expression.alias), depth);
        }
        case expression instanceof VariableExpression:
        case expression instanceof GlobalIdentifier:
        case expression instanceof EntityIdentifier:
        case expression instanceof Literal:
            return visitor(expression, depth);
        default:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            throw new Error(`Unknown Expression "${(expression as any).constructor.name}" received`);
    }
}

/** Walks through the expression along the main branch */
function walkBranch(expression: SourceExpression, visitor: (expression: Expression<string>) => void | false) {
    if (visitor(expression) === false){ 
        return false;
    }

    if (expression.source) {
        if (walk(expression.source, visitor) === false) {
            return false;
        }
    }

    return true;
}

/** Walks through the expression along the main branch */
function walkBranches(expression: Expression, visitor: (expression: Expression<string>) => void | false) {
    if (expression instanceof SourceExpression) {
        return walkBranch(expression, visitor);
    }

    for (const value of Object.values(expression)) {
        if (value instanceof Expression) {
            if (walkBranches(value, visitor) === false) {
                return false;
            }
        }
    }

    return true;
}


/** Walks through the expression and returns the expression found when visitor returns true */
function walkFind(expression: Expression<string>, visitor: (expression: Expression<string>) => boolean): Expression<string> | undefined {
    if (visitor(expression)) {
        return expression;
    }

    for (const value of Object.values(expression)) {
        if (value instanceof Expression) {
            const result = walkFind(value, visitor);
            if (result) {
                return result;
            }
        }
    }

    return undefined;
}

/** Walks through the expression along the main branch, searching for the desired expression */
function walkBranchFind(expression: SourceExpression, visitor: (expression: SourceExpression) => boolean): SourceExpression | undefined {
    if (visitor(expression)) {
        return expression;
    }

    if (expression.source) {
        return walkBranchFind(expression.source, visitor);
    }

    return undefined;
}

function walkBranchMutate(expression: SourceExpression, visitor: (expression: SourceExpression) => SourceExpression): SourceExpression {
    if (!expression.source) {
        return visitor(expression);
    }

    const result = walkBranchMutate(expression.source, visitor);
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

function source(expression: SourceExpression | Alias<SourceExpression> | FieldIdentifier): FromExpression {
    if (expression instanceof FieldIdentifier) {
        return source(expression.source);
    } else if (expression instanceof Alias) {
        return source(expression.expression);
    } else if (expression.source) {
        return source(expression.source);
    } else {
        return expression as FromExpression;
    }
}

function fieldSource(expression: SourceExpression | Alias<SourceExpression> | FieldIdentifier): FromExpression {
    if (expression instanceof FieldIdentifier) {
        return source(expression.source);
    } else if (expression instanceof Alias) {
        return source(expression.expression);
    } else if (expression.source) {
        return source(expression.source);
    } else {
        return expression as FromExpression;
    }
}

function sources(expression: Expression): FromExpression[] {
    const sources: FromExpression[] = [];

    walk(expression, (exp) => {
        if (exp instanceof FromExpression) {
            sources.push(exp);
        }
    });

    return sources;
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
