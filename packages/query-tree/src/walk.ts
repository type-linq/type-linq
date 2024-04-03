import { Expression } from './expression.js';
import { Source } from './source/index.js';

export type WalkOptions = {
    breadthFirst?: boolean;
}

export type WalkParams<TContext> = {
    context?: TContext;
    options: WalkOptions;
}

export type WalkResult<TResult> = {
    stop?: boolean;
    halt?: boolean;
    result?: TResult;
}

export type VisitorNode = {
    parent?: VisitorNode;
    node: Expression;
}

export type VisitorContext<TContext> = {
    context?: TContext;
    depth: number;
    parent?: VisitorNode;
}

export type Visitor<TContext, TWalkResult, TExpression extends Expression = Expression> = (expression: TExpression, context: VisitorContext<TContext>) => TWalkResult;

export class Walker {
    static walk<TContext = void>(
        expression: Expression,
        visitor: Visitor<TContext, WalkResult<void> | void>,
        params?: WalkParams<TContext> | undefined,
        context?: TContext,
    ) {
        walk(expression, visitor, params, {
            context: context,
            depth: 0,
            parent: undefined,
        });
    }

    static walkSource<TContext = void>(
        expression: Source,
        visitor: Visitor<TContext, boolean | void, Source>,
        context?: TContext,
    ) {
        walkSource(expression, visitor, {
            context,
            depth: 0,
            parent: undefined,
        });
    }

    static map<TContext>(
        expression: Expression,
        visitor: Visitor<TContext, Expression>,
        context?: TContext,
        ignore: (expression: Expression, context: VisitorContext<TContext>) => boolean = () => false,
    ): Expression {
        return map(expression, visitor, {
            context,
            depth: 0,
            parent: undefined,
        }, ignore);
    }

    static mapSource<TContext>(
        expression: Source,
        visitor: Visitor<TContext, Source, Source>,
        context?: TContext,
        ignore: (expression: Expression, context: VisitorContext<TContext>) => boolean = () => false,
    ): Source {
        return mapSource(expression, visitor, {
            context,
            depth: 0,
            parent: undefined,
        }, ignore);
    }

    static find<TContext = void>(
        expression: Expression,
        visitor: Visitor<TContext, boolean | undefined>,
        context?: TContext,
    ) {
        return find(expression, visitor, {
            context: context,
            depth: 0,
            parent: undefined,
        });
    }

    static findSource<TContext = void>(
        expression: Source,
        visitor: Visitor<TContext, boolean | undefined>,
        context?: TContext,
    ) {
        return findSource(expression, visitor, {
            context: context,
            depth: 0,
            parent: undefined,
        });
    }

    static collect<TContext = void>(
        expression: Expression,
        visitor: Visitor<TContext, boolean | undefined>,
        context?: TContext,
        ignore: (expression: Expression, context: VisitorContext<TContext>) => boolean = () => false,
    ) {
        return collect(expression, visitor, ignore, {
            context: context,
            depth: 0,
            parent: undefined,
        });
    }

    static collectSource<TContext = void>(
        expression: Source,
        visitor: Visitor<TContext, boolean | undefined>,
        context?: TContext,
    ) {
        return collectSource(expression, visitor, {
            context: context,
            depth: 0,
            parent: undefined,
        });
    }
}

function walk<TContext>(
    expression: Expression,
    visitor: Visitor<TContext, WalkResult<void> | void>,
    params: WalkParams<TContext> | undefined,
    context: VisitorContext<TContext>,
): WalkResult<void> {
    if (alreadyVisited(expression, context)) {
        return {};
    }

    const ctx: VisitorContext<TContext> = {
        context: context.context,
        depth: context.depth + 1,
        parent: {
            parent: context.parent,
            node: expression,
        }
    }

    const items = Array.from(expression.walk());

    if (params?.options.breadthFirst) {
        items.reverse();
    } else {
        const { stop, halt } = visitor(expression, context) ?? { };
        if (stop || halt) {
            return { stop, halt };
        }
    }

    for (const item of items) {
        const { stop, halt } = walk(item, visitor, params, ctx);
        if (stop) {
            break;
        }
        if (halt) {
            return { halt };
        }
    }

    if (!params?.options.breadthFirst) {
        const { stop, halt } = visitor(expression, context) ?? { };
        if (stop || halt) {
            return { stop, halt };
        }
    }

    return {};
}

function walkSource<TContext>(
    expression: Source,
    visitor: Visitor<TContext, boolean | void, Source>,
    context: VisitorContext<TContext>,
) {
    if (visitor(expression, context) === false) {
        return;
    }

    const ctx: VisitorContext<TContext> = {
        context: context.context,
        depth: context.depth + 1,
        parent: {
            parent: context.parent,
            node: expression,
        }
    };

    if (expression.source !== undefined) {
        walkSource(expression.source, visitor, ctx);
    }
}

function map<TContext>(
    expression: Expression,
    visitor: Visitor<TContext, Expression>,
    context: VisitorContext<TContext>,
    ignore: (expression: Expression, context: VisitorContext<TContext>) => boolean,
): Expression {
    if (ignore(expression, context)) {
        return expression;
    }

    if (alreadyVisited(expression, context)) {
        const result = visitor(expression, context);
        return result;
    }

    const ctx: VisitorContext<TContext> = {
        context: context.context,
        depth: context.depth + 1,
        parent: {
            parent: context.parent,
            node: expression,
        }
    }

    const expressions = Array.from(expression.walk()).map(
        (exp) => map(exp, visitor, ctx, ignore)
    );

    const mutated = expression.mutate(expressions);
    const result = visitor(mutated, context);
    return result;
}

function mapSource<TContext>(
    expression: Source,
    visitor: Visitor<TContext, Source, Source>,
    context: VisitorContext<TContext>,
    ignore: (expression: Expression, context: VisitorContext<TContext>) => boolean,
): Source {
    if (ignore(expression, context)) {
        return expression;
    }

    const ctx: VisitorContext<TContext> = {
        context: context.context,
        depth: context.depth + 1,
        parent: {
            parent: context.parent,
            node: expression,
        }
    }

    if (expression.source === undefined) {
        return visitor(expression, ctx);
    }

    const source = mapSource(expression.source, visitor, ctx, ignore);

    //  All source expressions who have a source take that parameter
    //  as the first.... Bit of a hack but oh well...
    const values = Array.from(expression.walk());
    values[0] = source;

    const mutated = expression.mutate(values) as Source;
    const result = visitor(mutated, context);
    return result;
}

function find<TContext>(
    expression: Expression,
    visitor: Visitor<TContext, boolean | undefined>,
    context: VisitorContext<TContext>,
): Expression | undefined {
    if (alreadyVisited(expression, context)) {
        return undefined;
    }

    if (visitor(expression, context) === true) {
        return expression;
    }

    const ctx: VisitorContext<TContext> = {
        context: context.context,
        depth: context.depth + 1,
        parent: {
            parent: context.parent,
            node: expression,
        }
    };

    for (const item of expression.walk()) {
        const result = find(item, visitor, ctx);
        if (result !== undefined) {
            return result;
        }
    }

    return undefined;
}

function findSource<TContext>(
    expression: Source,
    visitor: Visitor<TContext, boolean | undefined>,
    context: VisitorContext<TContext>,
): Source | undefined {
    if (alreadyVisited(expression, context)) {
        return undefined;
    }

    if (visitor(expression, context) === true) {
        return expression;
    }

    const ctx: VisitorContext<TContext> = {
        context: context.context,
        depth: context.depth + 1,
        parent: {
            parent: context.parent,
            node: expression,
        }
    };

    if (expression.source) {
        return findSource(expression.source, visitor, ctx);
    }

    return undefined;
}

function collect<TContext>(
    expression: Expression,
    visitor: Visitor<TContext, boolean | undefined>,
    ignore: (expression: Expression, context: VisitorContext<TContext>) => boolean,
    context: VisitorContext<TContext>,
): Expression[] {
    if (alreadyVisited(expression, context)) {
        return [];
    }

    if (ignore(expression, context)) {
        return [];
    }

    const result: Expression[] = [];
    if (visitor(expression, context) === true) {
        result.push(expression);
    }

    const ctx: VisitorContext<TContext> = {
        context: context.context,
        depth: context.depth + 1,
        parent: {
            parent: context.parent,
            node: expression,
        }
    };

    for (const item of expression.walk()) {
        const collected = collect(item, visitor, ignore, ctx);
        result.push(...collected);
    }

    return result;
}

function collectSource<TContext>(
    expression: Source,
    visitor: Visitor<TContext, boolean | undefined>,
    context: VisitorContext<TContext>,
): Source[] {
    const result: Source[] = [];
    if (visitor(expression, context) === true) {
        result.push(expression);
    }

    const ctx: VisitorContext<TContext> = {
        context: context.context,
        depth: context.depth + 1,
        parent: {
            parent: context.parent,
            node: expression,
        }
    };

    if (expression.source !== undefined) {
        const collected = collectSource(expression.source, visitor, ctx);
        result.push(...collected);
    }

    return result;
}

function alreadyVisited(expression: Expression, context: VisitorContext<unknown>) {
    let current = context.parent;
    while (current) {
        if (current.node === expression) {
            return true;
        }
        current = current.parent;
    }
    return false;
}