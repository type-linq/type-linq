import { Expression, ExpressionTypeKey, Serializable } from '../../../core/src/type';
import { DatabaseSchema } from '../schema';
import { Context, context } from './context';
import { SqlFragment, encodeIdentifier } from './sql';

type IdentifiedSqlFragment = SqlFragment & {
    identifier: string;
}

export function prepare(expression: Expression<ExpressionTypeKey>, schema: DatabaseSchema, globals: Map<string[], string>): SqlFragment {
    let ctx = context(expression, schema, globals);

    if (!ctx) {
        throw new Error(`No context returned`);
    }

    // Remove any unecessary outer layers
    // TODO: Remove any empty contexts (which have a source)
    ctx = unwind(ctx);

    const ctes: IdentifiedSqlFragment[] = []
    // The source context will be the empty one, so we
    //  use it as the loop break
    while (!isEmpty(ctx)) {
        ctes.push(process(ctx!));
        ctx = ctx!.source;

        // Ignore the source context
        if (ctx && isEmpty(ctx)) {
            ctx = undefined;
        }
    }

    if (ctes.length === 0) {
        throw new Error(`Got no contexts back`);
    }

    const last = ctes.pop()!;
    const wrappedCtes = ctes.map(wrapCte);

    const cteSql = ctes.length === 0 ? `` : `WITH ${wrappedCtes.map(cte => cte.sql).join(`,\n`)}\n`
    const cteVariables = [...ctes.map((cte) => cte.variables).flat(1)];


    const sql = `${cteSql}${last.sql}`;
    const variables: Serializable[] = [...cteVariables, ...last.variables];

    return {
        sql,
        variables,
    };

    function unwind(context: Context) {
        while (isEmpty(context)) {
            return unwind(context.source!);
        }
        return context;
    }

    function process(context: Context): IdentifiedSqlFragment {
        const sql: string[] = [];

        if (context.select === undefined) {
            sql.push(`SELECT *`);
        } else {
            sql.push(`SELECT ${context.select.sql}`);
        }

        if (context.source) {
            const identifier = encodeIdentifier(context.source.identifier);
            sql.push(`FROM ${identifier}`);
        } else {
            const identifier = encodeIdentifier(context.identifier);
            sql.push(`FROM ${identifier}`);
        }

        if (context.where !== undefined) {
            sql.push(`WHERE ${context.where.sql}`);
        }

        return {
            identifier: context.identifier,
            sql: sql.join(`\n`),
            variables: [
                ...(context.select?.variables || []),
                ...(context.where?.variables || [])
            ],
        };
    }

    function wrapCte(fragment: IdentifiedSqlFragment): SqlFragment {
        const identifier = encodeIdentifier(fragment.identifier);
        return {
            sql: `${identifier} AS (\n${fragment.sql}\n)`,
            variables: fragment.variables,
        }
    }

    function isEmpty(context: Context | undefined) {
        if (context === undefined) {
            return true;
        }

        if (context.select) {
            return false;
        }

        if (context.where) {
            return false;
        }

        return true;
    }
}