import { convert } from '../convert/convert';
import { readName } from '../convert/util';
import { Queryable } from './queryable';
import { LogicalExpression } from '../tree/binary';
import { Expression } from '../tree/expression';
import { Predicate } from '../type';
import { parseFunction } from './parse';
import { SourceExpression } from '../tree/source';
import { SelectExpression } from '../tree/select';
import { JoinExpression } from '../tree/join';
import { Globals } from '../convert/global';

export function where<TElement, TArgs = unknown>(
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
    const { expression, linkChains } = convert(
        sources,
        ast.body,
        varsName,
        globals,
    );

    if (expression instanceof LogicalExpression === false) {
        throw new Error(`Expected the where predicate to return a LogicalExpression`);
    }

    const joins = buildChainJoins(linkChains);

    let select: SelectExpression;
    if (this.expression instanceof SourceExpression) {
        select = new SelectExpression(
            this.expression.columns,
            this.expression,
            expression,
            joins
        );
    } else if (this.expression instanceof SelectExpression) {
        const where = this.expression.where ?
            new LogicalExpression(this.expression.where, `&&`, expression) :
            expression;

        const finalJoins = joins.filter(
            (join) => hasMatchingJoin(this.expression as SelectExpression, join) === false
        );

        select = new SelectExpression(
            this.expression.columns,
            this.expression.source,
            where,
            [
                ...this.expression.join,
                ...finalJoins,
            ]
        );
    } else {
        throw new Error(`Expected either a source expression or a select expression`);
    }

    return new Queryable<TElement>(
        this.provider,
        select,
    );

    function buildChainJoins(linkChains: Record<string, SourceExpression[]>): JoinExpression[] {
        return Object.entries(linkChains).map(([name, chain]) => {
            throw new Error(`not implemented`);
        });
    }

    function hasMatchingJoin(select: SelectExpression, join: JoinExpression) {
        // for (const jn of select.join) {
        //     throw new Error(`not implemented`);
        // }
        return false;
    }
}