import { convert } from '../convert/convert';
import { randString, readName } from '../convert/util';
import { Queryable } from './queryable';
import { Expression as AstExpression } from '../type';
import { Expression, ExpressionType } from '../tree/expression';
import { Merge, Map as ValueMap, Serializable, ExpressionTypeKey } from '../type';
import { parseFunction } from './parse';
import { SourceExpression } from '../tree/source';
import { SelectExpression } from '../tree/select';
import { Globals } from '../convert/global';
import { JoinClause, JoinExpression } from '../tree/join';
import { Column } from '../tree/column';
import { SCALAR_NAME, transformSelect } from './select';
import { asArray, joinExists } from '../tree/util';
import { buildSources, expressionSource, replaceSource, varsName } from './util';

// TODO: Add override that will take inner and 2 functions...
//  1. A function that will return a logical expression used to join
//  2. A result selector

export function join<TOuter, TInner, TKey, TResult, TArgs extends Serializable | undefined = undefined>(
    this: Queryable<TOuter>,
    inner: Queryable<TInner>,
    outerKey: ValueMap<TOuter, TKey>,
    innerKey: ValueMap<TInner, TKey>,
    result: Merge<TOuter, TInner, TResult>,
    args?: TArgs,
): Queryable<TResult> {
    if (this.expression instanceof SourceExpression === false && this.expression instanceof SelectExpression === false) {
        throw new Error(`Expected outer expression to be a SourceExpression or a SelectExpression`);
    }

    if (inner.expression instanceof SourceExpression === false && inner.expression instanceof SelectExpression === false) {
        throw new Error(`Expected inner expression to be a SourceExpression or a SelectExpression`);
    }

    const outerExpression = this.expression;
    let innerExpression = inner.expression;

    const outerAst = parseFunction(outerKey, 1, args);
    const innerAst = parseFunction(innerKey, 1, args);
    const resultAst = parseFunction(result, 2, args);

    const globals: Globals = this.provider.globals;

    const outerColumns = processKey(outerAst, outerExpression);
    const innerColumns = processKey(innerAst, innerExpression);

    if (Array.isArray(outerColumns) !== Array.isArray(innerColumns)) {
        throw new Error(`The inner and outer keys returned incompatible result types`);
    }

    if (Array.isArray(outerColumns) && outerColumns.length !== (innerColumns as unknown[]).length) {
        throw new Error(`The inner and outer keys returned different number of columns to match on`);
    }

    const clauses = asArray(outerColumns).map(
        (outer, index) => new JoinClause(
            outer.expression,
            asArray(innerColumns)[index].expression,
        )
    );

    const innerSourceExpression = expressionSource(innerExpression);
    let hasExisting = false;
    if (outerExpression instanceof SelectExpression) {
        for (const join of outerExpression.join) {
            const jsource = expressionSource(join.source);
            if (innerSourceExpression.resource === jsource.resource) {
                hasExisting = true;
                break;
            }
        }
    }

    if (hasExisting) {
        // Note: We use the resource to avoid growing names
        const name = `${innerSourceExpression.resource}_${randString(4)}`;
        innerExpression = replaceSource(
            innerExpression,
            (existing) => new SourceExpression(
                existing.resource,
                existing.columns,
                name,
            )
        );
    }

    const join = new JoinExpression(
        innerExpression,
        clauses,
    );

    const columns = transformSelect(
        [outerExpression, innerExpression],
        resultAst,
        this.provider.globals,
    );

    let select: SelectExpression;
    if (outerExpression instanceof SourceExpression) {
        select = new SelectExpression(columns, outerExpression, undefined, [join]);
    } else if (outerExpression instanceof SelectExpression) {
        const joins = joinExists(outerExpression.join, join) ?
            outerExpression.join :
            [...outerExpression.join, join];
        select = new SelectExpression(
            columns,
            outerExpression.source,
            outerExpression.where,
            joins,
        );
    } else {
        throw new Error(`Expected either a source expression or a select expression`);
    }

    return new Queryable<TResult>(
        this.provider,
        select,
    );

    function processKey(expression: AstExpression<`ArrowFunctionExpression`>, ...sources: Expression<ExpressionType>[]) {
        const sourceMap = buildSources(expression, ...sources);
        const vars = varsName(expression);

        switch (expression.body.type) {
            case `ArrayExpression`:
                return expression.body.elements.map(
                    (element, index) => processKeyValue(element, String(index), vars, sourceMap)
                );
            case `ObjectExpression`:
                return expression.body.properties.map(
                    (property) => {
                        if (property.type !== `Property`) {
                            throw new Error(`Expected ObjectExpression.properties to all be "Property" Expressions`);
                        }
                        const name = readName(property.key) as string;
                        return processKeyValue(property.value, name, vars, sourceMap);
                    }
                );
            default:
                return processKeyValue(expression.body, SCALAR_NAME, vars, sourceMap);
        }
    }

    function processKeyValue(
        expression: AstExpression<ExpressionTypeKey>,
        name: string,
        varsName: string | undefined,
        sources: Record<string, Expression<ExpressionType>>,
    ) {
        switch (expression.type) {
            case `Identifier`:
            case `MemberExpression`:
            case `CallExpression`:
            case `Literal`:
            case `TemplateLiteral`:
                break;
            default:
                throw new Error(`Unsupported column Expression.type "${expression.type}"`);
        }

        const converted = convert(
            sources,
            expression,
            varsName,
            globals,
            args,
        );

        return new Column(converted.expression, name, converted.linkMap);
    }
}
