import { convert } from '../convert/convert';
import { readName } from '../convert/util';
import { Queryable } from './queryable';
import { BinaryExpression, LogicalExpression } from '../tree/binary';
import { Expression, ExpressionType } from '../tree/expression';
import { Predicate, Serializable } from '../type';
import { parseFunction } from './parse';
import { SourceExpression } from '../tree/source';
import { SelectExpression, buildImplicitJoins } from '../tree/select';
import { Globals } from '../convert/global';

export function where<TElement, TArgs extends Serializable | undefined = undefined>(
    this: Queryable<TElement>,
    predicate: Predicate<TElement, TArgs>,
    args?: TArgs,
) {
    const ast = parseFunction(predicate, 1, args);

    const sourceName = ast.params.length > 0 ?
        readName(ast.params[0]) :
        undefined;

    const varsName = ast.params.length > 1 ?
        readName(ast.params.at(-1)!) :
        undefined;

    const sources: Record<string | symbol, Expression<ExpressionType>> = {};
    if (sourceName !== undefined) {
        sources[sourceName] = this.expression;
    }

    const globals: Globals = this.provider.globals;

    // The where expression. This is the first parmeter
    // TODO: Why are the identifiers coming out of here not fully qualified?
    const { expression, linkMap } = convert(
        sources,
        ast.body,
        varsName,
        globals,
        args,
    );

    if (expression instanceof LogicalExpression === false && expression instanceof BinaryExpression === false) {
        throw new Error(`Expected the where predicate to return a LogicalExpression or BinaryExpression. Got ${expression.constructor.name}`);
    }

    let select: SelectExpression;
    if (this.expression instanceof SourceExpression) {
        const joins = buildImplicitJoins([], linkMap);
        select = new SelectExpression(
            this.expression.columns,
            this.expression,
            expression,
            joins
        );
    } else if (this.expression instanceof SelectExpression) {
        const joins = buildImplicitJoins(this.expression.join, linkMap);
        const where = this.expression.where ?
            new LogicalExpression(this.expression.where, `&&`, expression) :
            expression;

        select = new SelectExpression(
            this.expression.columns,
            this.expression.source,
            where,
            joins,
        );
    } else {
        throw new Error(`Expected either a source expression or a select expression`);
    }

    return new Queryable<TElement>(
        this.provider,
        select,
    );
}