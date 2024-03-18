// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { parse } from 'espree';
import { Expression, ExpressionType } from '../type.js';
import { bindVars } from '../convert/prepare/args.js';
import { undoTypeScriptTransforms } from '../convert/prepare/type-script.js';

export function parseFunction<TArgs extends unknown[], TResult>(
    handler: (...args: TArgs) => TResult,
    count: number,
    args?: unknown,
): Expression<`ArrowFunctionExpression`> {
    // TODO: Caching
    const finalSource = `const f = ${handler.toString()}`;
    const ast = parse(finalSource, {
        ecmaVersion: `latest`
    });

    const unwrapped = unwrap(ast);

    const prepared = prepare(unwrapped, count, args);
    return prepared;
}

function unwrap(expression: Expression<`Program`>): Expression<`ArrowFunctionExpression`> {
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
    } as Expression<`ArrowFunctionExpression`>;
}

function prepare(expression: Expression<`ArrowFunctionExpression`>, count: number, args?: unknown) {
    bindVars(expression, count, args);

    // TODO: This needs to be controlled via configuration
    expression = undoTypeScriptTransforms(expression) as Expression<`ArrowFunctionExpression`>;

    return expression;
}