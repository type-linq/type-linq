/* eslint-disable @typescript-eslint/no-explicit-any */
import { Literal, Source, VariableExpression } from '@type-linq/query-tree';
import { QueryProvider } from '../query-provider.js';
import { select } from './select.js';
import { where } from './where.js';
import { join } from './join.js';
import { Expression, ExpressionType, ExpressionTypeKey, Func, Serializable } from '../type.js';
import { SchemaType, StandardType } from '../schema-type.js';
import { orderBy, orderByDescending, thenBy, thenByDescending } from './order.js';
import { distinct } from './distinct.js';
import { groupBy } from './group.js';
import { first, firstOrDefault, single, singleOrDefault, skip, take } from './range.js';
import { append, defaultIfEmpty, prepend } from './transform.js';
import { parseFunction } from './parse.js';
import { convert } from '../convert/convert.js';

export type GroupResult<TElement, TMapped, TResult> =
    TResult extends undefined
    ? TMapped extends undefined
    ? Queryable<TElement>
    : Queryable<TMapped>
    : Queryable<TResult>;

// TODO: Add SchemaType and StandardType where missing
// TODO: We need an EmbeddedQueryable type which will be used inside the expressions....

export class Queryable<TElement> {
    readonly provider: QueryProvider;
    readonly expression: Source;

    constructor(provider: QueryProvider, expression: Source) {
        this.provider = provider;
        this.expression = expression;
    }

    [Symbol.asyncIterator](): AsyncGenerator<TElement> {
        return this.provider.execute(this);
    }

    select<TMapped>(map: Func<TMapped, [SchemaType<TElement>]>, args?: Serializable) {
        const ast = parseFunction(map, 1, args);
        const source = select(this.provider, this.expression, ast, args);
        return new Queryable<TMapped>(this.provider, source);
    }

    where<TArgs extends Serializable | undefined = undefined>(predicate: Func<boolean, [SchemaType<TElement>, TArgs]>, args?: TArgs) {
        const predicateAst = parseFunction(predicate, 1, args);
        const expression = where(
            this.provider,
            this.expression,
            predicateAst,
            args,
        );

        return new Queryable<TElement>(
            this.provider,
            expression,
        );
    }

    join<TInner, TKey, TResult, TArgs extends Serializable | undefined = undefined>(
        inner: Queryable<TInner>,
        outerKey: Func<TKey, [SchemaType<TElement>]>,
        innerKey: Func<TKey, [SchemaType<TInner>]>,
        result: Func<TResult, [SchemaType<TElement>, SchemaType<TInner>]>,
        args?: TArgs,
    ) {
        if (this.provider !== inner.provider) {
            throw new Error(`Must join sources with the same provider`);
        }

        const outerAst = parseFunction(outerKey, 1, args);
        const innerAst = parseFunction(innerKey, 1, args);
        const resultAst = parseFunction(result, 2, args);

        const expression = join(
            this.provider,
            this.expression,
            inner.expression,
            outerAst,
            innerAst,
            resultAst,
            args,
        );

        return new Queryable<StandardType<TResult>>(this.provider, expression);
    }

    orderBy<TKey>(
        key: Func<TKey, [SchemaType<TElement>]>,
        args?: Serializable,
    ) {
        const keyAst = parseFunction(key, 1, args);
        const expression = orderBy(
            this.provider,
            this.expression,
            keyAst,
            args
        );

        return new Queryable<TElement>(
            this.provider,
            expression,
        );
    }

    orderByDescending<TKey>(
        key: Func<TKey, [SchemaType<TElement>]>,
        args?: Serializable,
    ) {
        const keyAst = parseFunction(key, 1, args);
        const expression = orderByDescending(
            this.provider,
            this.expression,
            keyAst,
            args
        );

        return new Queryable<TElement>(
            this.provider,
            expression,
        );      
    }

    thenBy<TKey>(
        key: Func<TKey, [SchemaType<TElement>]>,
        args?: Serializable,
    ) {
        const keyAst = parseFunction(key, 1, args);
        const expression = thenBy(
            this.provider,
            this.expression,
            keyAst,
            args
        );

        return new Queryable<TElement>(
            this.provider,
            expression,
        );
    }

    thenByDescending<TKey>(
        key: Func<TKey, [SchemaType<TElement>]>,
        args?: Serializable,
    ) {
        const keyAst = parseFunction(key, 1, args);
        const expression = thenByDescending(
            this.provider,
            this.expression,
            keyAst,
            args
        );

        return new Queryable<TElement>(
            this.provider,
            expression,
        );
    }

    distinct() {
        const expression = distinct(this.expression);
        return new Queryable<TElement>(
            this.provider,
            expression,
        );
    }

    groupBy<
        TKey,
        TMapped = undefined,
        TResult = undefined,
    >(
        key: Func<TKey, [SchemaType<TElement>]>,
        element?: Func<TMapped, [SchemaType<TElement>]>,
        result?: Func<TResult, [TKey, Queryable<TMapped extends undefined ? SchemaType<TElement> : TMapped>]>,
        args?: Serializable,
    ): GroupResult<TElement, TMapped, TResult>  {   
        const keyAst = parseFunction(key, 1, args);
        const elementAst = element && parseFunction(element, 1, args);
        const resultAst = result && parseFunction(result, 2, args);

        const expression = groupBy(
            this.provider,
            this.expression,
            keyAst,
            elementAst,
            resultAst,
            args,
        );
        return new Queryable(this.provider, expression) as GroupResult<TElement, TMapped, TResult>;
    }

    skip(count: number) {
        const expression = skip(this.expression, count);
        return new Queryable<TElement>(this.provider, expression);
    }

    take(count: number) {
        const expression = take(this.expression, count);
        return new Queryable<TElement>(this.provider, expression);
    }

    async first() {
        const limited = await first(this.expression);
        const query = new Queryable<TElement>(this.provider, limited);
        for await (const result of query) {
            return result;
        }

        throw new Error(`Sequence contains no results`);
    }

    async firstOrDefault() {
        const limited = firstOrDefault(this.expression);
        const query = new Queryable<TElement>(this.provider, limited);
        for await (const result of query) {
            return result;
        }

        return null;
    }

    async single() {
        const limited = single(this.expression);
        const query = new Queryable<TElement>(this.provider, limited);
        let result: TElement | undefined = undefined;
        for await (const item of query) {
            if (result !== undefined) {
                throw new Error(`Sequence contains multiple results`);
            }
            result = item;
        }

        if (result === undefined) {
            throw new Error(`Sequence contains no results`);
        }

        return result as TElement;
    }

    async singleOrDefault() {
        const limited = singleOrDefault(this.expression);
        const query = new Queryable<TElement>(this.provider, limited);
        let result: TElement | undefined = undefined;
        for await (const item of query) {
            if (result !== undefined) {
                throw new Error(`Sequence contains multiple results`);
            }
            result = item;
        }

        if (result === undefined) {
            return null;
        }

        return result as TElement;
    }

    // TODO: This needs to accept no elements!
    defaultIfEmpty(defaultValue: TElement) {
        const expression = defaultIfEmpty(this.expression, defaultValue);
        return new Queryable<TElement>(this.provider, expression);
    }

    prepend(elements: TElement[]) {
        const expression = prepend(this.expression, elements);
        return new Queryable<TElement>(this.provider, expression);
    }

    append(elements: TElement[]) {
        const expression = append(this.expression, elements);
        return new Queryable<TElement>(this.provider, expression);
    }

    // TODO: Max and min need to have functions to select the columns
}

// TODO: This isn't quite right... this can ONLY accept expressions (Except for args)...
//  never anything else...
// so numbers for take and skip are out....

export class QueryableEmbedded {
    readonly provider: QueryProvider;
    readonly expression: Source;

    constructor(provider: QueryProvider, expression: Source) {
        this.provider = provider;
        this.expression = expression;
    }

    select(
        map: Expression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        const result = select(
            this.provider,
            this.expression,
            map,
            args,
        );
        return new QueryableEmbedded(this.provider, result);
    }

    where(
        predicate: Expression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        const expression = where(
            this.provider,
            this.expression,
            predicate,
            args,
        );
        return new QueryableEmbedded(this.provider, expression);
    }

    join(
        inner: Source,
        outerKey: Expression<`ArrowFunctionExpression`>,
        innerKey: Expression<`ArrowFunctionExpression`>,
        result: Expression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        const expression = join(
            this.provider,
            this.expression,
            inner,
            outerKey,
            innerKey,
            result,
            args,
        );
        return new QueryableEmbedded(this.provider, expression);
    }

    orderBy(
        key: Expression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        const expression = orderBy(
            this.provider,
            this.expression,
            key,
            args
        );
        return new QueryableEmbedded(this.provider, expression);
    }

    orderByDescending(
        key: Expression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        const expression = orderByDescending(
            this.provider,
            this.expression,
            key,
            args
        );
        return new QueryableEmbedded(this.provider, expression);
    }

    thenBy(
        key: Expression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        const expression = thenBy(
            this.provider,
            this.expression,
            key,
            args
        );
        return new QueryableEmbedded(this.provider, expression);
    }

    thenByDescending(
        key: Expression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        const expression = thenByDescending(
            this.provider,
            this.expression,
            key,
            args
        );
        return new QueryableEmbedded(this.provider, expression);
    }

    distinct() {
        const expression = distinct(this.expression);
        return new QueryableEmbedded(this.provider, expression);
    }

    groupBy(
        key: Expression<`ArrowFunctionExpression`>,
        element?: Expression<`ArrowFunctionExpression`>,
        result?: Expression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        const expression = groupBy(
            this.provider,
            this.expression,
            key,
            element,
            result,
            args,
        );
        return new QueryableEmbedded(this.provider, expression);
    }

    skip(expression: Expression<ExpressionTypeKey>, args?: Serializable) {
        // TODO: Need to convert this expression in isolation....
        //  It shoudn't be referencing an entity, so we should be OK to convert without context
        const converted = convert(
            {},
            expression,
            undefined,
            this.provider.globals,
            args,
        );

        // TODO: Skip and take expressions are wroing...

        switch (true) {
            case converted instanceof Literal:
                throw new Error(`not implemented`);
            case converted instanceof VariableExpression:
                throw new Error(`not implemented`);
        }

        const exp = skip(this.expression, count);
        return new QueryableEmbedded(this.provider, exp);
    }

    take(expression: Expression<ExpressionTypeKey>) {
        const exp = take(this.expression, count);
        return new QueryableEmbedded(this.provider, exp);
    }

    firstOrDefault() {
        const limited = firstOrDefault(this.expression);
        return new QueryableEmbedded(this.provider, limited);
    }

    singleOrDefault() {
        const limited = singleOrDefault(this.expression);
        return new QueryableEmbedded(this.provider, limited);
    }

    defaultIfEmpty() {
        throw new Error(`"defaultIfEmpty" is not supported in a sub expression`);
    }


    first() {
        throw new Error(`"first" is not supported in a sub expression. Consider using "firstOrDefault" instead`);
    }

    single() {
        throw new Error(`"single" is not supported in a sub expression. Consider using "singleOrDefault" instead`);
    }

    prepend() {
        throw new Error(`"prepend" is not supported in a sub expression`);
    }

    append() {
        throw new Error(`"append" is not supported in a sub expression`);
    }
}
