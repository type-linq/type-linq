/* eslint-disable @typescript-eslint/no-explicit-any */
import { Source } from '@type-linq/query-tree';
import { QueryProvider } from '../query-provider.js';
import { select } from './select.js';
import { where } from './where.js';
import { join } from './join.js';
import { Expression as AstExpression, ExpressionTypeKey, Func, Serializable } from '../type.js';
import { SchemaType, StandardType } from '../schema-type.js';
import { orderBy, orderByDescending, thenBy, thenByDescending } from './order.js';
import { distinct } from './distinct.js';
import { groupBy } from './group.js';
import { first, firstOrDefault, single, singleOrDefault, skip, take } from './range.js';
import { append, defaultIfEmpty, prepend } from './transform.js';
import { parseFunction, prepare } from './parse.js';
import { convert } from '../convert/convert.js';
import { sum } from './math.js';

export type GroupResult<TElement, TMapped, TResult> =
    TResult extends undefined
    ? TMapped extends undefined
    ? Queryable<TElement>
    : Queryable<TMapped>
    : Queryable<TResult>;

// TODO: Add SchemaType and StandardType where missing
// TODO: We need an EmbeddedQueryable type which will be used inside the expressions....
// TODO: Max and min need to have functions to select the columns

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
        result?: Func<TResult, [TKey, EmbeddedQueryable<TMapped extends undefined ? SchemaType<TElement> : TMapped>]>,
        args?: Serializable,
    ): GroupResult<TElement, TMapped, TResult> {
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
        const result = await singleItem(query);
        return result;
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

    async sum(field: Func<number, [SchemaType<TElement>]>, args?: Serializable) {
        const fieldAst = parseFunction(field, 1, args);
        const expression = sum(
            this.provider,
            this.expression,
            fieldAst,
            args,
        );

        const query = new Queryable<number>(this.provider, expression);
        const result = await singleItem(query);
        return result;
    }
}

export class QueryableEmbedded {
    readonly provider: QueryProvider;
    readonly expression: Source;

    constructor(provider: QueryProvider, expression: Source) {
        this.provider = provider;
        this.expression = expression;
    }

    select(
        map: AstExpression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        if (map.type !== `ArrowFunctionExpression`) {
            throw new Error(`Expected map to be a function`);
        }

        const preparedMap = prepare(map, 1, args);
        const result = select(
            this.provider,
            this.expression,
            preparedMap,
            args,
        );
        return new QueryableEmbedded(this.provider, result);
    }

    where(
        predicate: AstExpression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        if (predicate.type !== `ArrowFunctionExpression`) {
            throw new Error(`Expected predicate to be a function`);
        }

        const preparedPredicate = prepare(predicate, 1, args);
        const expression = where(
            this.provider,
            this.expression,
            preparedPredicate,
            args,
        );
        return new QueryableEmbedded(this.provider, expression);
    }

    join(
        inner: Source,
        outerKey: AstExpression<`ArrowFunctionExpression`>,
        innerKey: AstExpression<`ArrowFunctionExpression`>,
        result: AstExpression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        if (outerKey.type !== `ArrowFunctionExpression`) {
            throw new Error(`Expected outerKey to be a function`);
        }

        if (innerKey.type !== `ArrowFunctionExpression`) {
            throw new Error(`Expected innerKey to be a function`);
        }

        if (result.type !== `ArrowFunctionExpression`) {
            throw new Error(`Expected result to be a function`);
        }

        const preparedOuterKey = prepare(outerKey, 1, args);
        const preparedInnerKey = prepare(innerKey, 1, args);
        const preparedResult = prepare(result, 2, args);

        const expression = join(
            this.provider,
            this.expression,
            inner,
            preparedOuterKey,
            preparedInnerKey,
            preparedResult,
            args,
        );
        return new QueryableEmbedded(this.provider, expression);
    }

    orderBy(
        key: AstExpression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        if (key.type !== `ArrowFunctionExpression`) {
            throw new Error(`Expected key to be a function`);
        }

        const preparedKey = prepare(key, 1, args);
        const expression = orderBy(
            this.provider,
            this.expression,
            preparedKey,
            args
        );
        return new QueryableEmbedded(this.provider, expression);
    }

    orderByDescending(
        key: AstExpression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        if (key.type !== `ArrowFunctionExpression`) {
            throw new Error(`Expected key to be a function`);
        }

        const preparedKey = prepare(key, 1, args);
        const expression = orderByDescending(
            this.provider,
            this.expression,
            preparedKey,
            args
        );
        return new QueryableEmbedded(this.provider, expression);
    }

    thenBy(
        key: AstExpression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        if (key.type !== `ArrowFunctionExpression`) {
            throw new Error(`Expected key to be a function`);
        }

        const preparedKey = prepare(key, 1, args);
        const expression = thenBy(
            this.provider,
            this.expression,
            preparedKey,
            args
        );
        return new QueryableEmbedded(this.provider, expression);
    }

    thenByDescending(
        key: AstExpression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        if (key.type !== `ArrowFunctionExpression`) {
            throw new Error(`Expected key to be a function`);
        }

        const preparedKey = prepare(key, 1, args);
        const expression = thenByDescending(
            this.provider,
            this.expression,
            preparedKey,
            args
        );
        return new QueryableEmbedded(this.provider, expression);
    }

    distinct() {
        const expression = distinct(this.expression);
        return new QueryableEmbedded(this.provider, expression);
    }

    groupBy(
        key: AstExpression<`ArrowFunctionExpression`>,
        element?: AstExpression<`ArrowFunctionExpression`>,
        result?: AstExpression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        if (key.type !== `ArrowFunctionExpression`) {
            throw new Error(`Expected key to be a function`);
        }

        if (element && element.type !== `ArrowFunctionExpression`) {
            throw new Error(`Expected element to be a function`);
        }

        if (result && result.type !== `ArrowFunctionExpression`) {
            throw new Error(`Expected result to be a function`);
        }

        const preparedKey = prepare(key, 1, args);
        const preparedElement = element && prepare(element, 1, args);
        const preparedResult = result && prepare(result, 2, args);

        const expression = groupBy(
            this.provider,
            this.expression,
            preparedKey,
            preparedElement,
            preparedResult,
            args,
        );
        return new QueryableEmbedded(this.provider, expression);
    }

    skip(
        expression: AstExpression<ExpressionTypeKey>,
        args?: Serializable,
    ) {
        const converted = convert(
            {},
            expression,
            this.provider,
            undefined,
            args,
        );

        const exp = skip(this.expression, converted);
        return new QueryableEmbedded(this.provider, exp);
    }

    take(
        expression: AstExpression<ExpressionTypeKey>,
        args?: Serializable,
    ) {
        const converted = convert(
            {},
            expression,
            this.provider,
            undefined,
            args,
        );

        const exp = take(this.expression, converted);
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

    sum(
        field: AstExpression<`ArrowFunctionExpression`>,
        args?: Serializable,
    ) {
        if (field.type !== `ArrowFunctionExpression`) {
            throw new Error(`Expected field to be a function`);
        }

        const preparedField = prepare(field, 1, args);

        const expression = sum(
            this.provider,
            this.expression,
            preparedField,
            args,
        );
        return new QueryableEmbedded(this.provider, expression);
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

export type NoArgsParam<T extends unknown[]> = T extends [...infer TParams, Serializable?]
    ? [...TParams]
    : T;

export type NoArgs<T> = {
    [K in keyof T]: T[K] extends (...args: infer TArgs) => T
    ? (...params: NoArgsParam<TArgs>) => T
    : T[K];
}

export type EmbeddedQueryable<TElement> = {
    readonly provider: QueryProvider;
    readonly expression: Source;

    select<TMapped>(
        map: Func<TMapped, [SchemaType<TElement>]>,
    ): Queryable<TMapped>;

    where<TArgs extends Serializable | undefined = undefined>(
        predicate: Func<boolean, [SchemaType<TElement>, TArgs]>,
    ): Queryable<TElement>;

    join<TInner, TKey, TResult>(
        inner: Queryable<TInner>,
        outerKey: Func<TKey, [SchemaType<TElement>]>,
        innerKey: Func<TKey, [SchemaType<TInner>]>,
        result: Func<TResult, [SchemaType<TElement>, SchemaType<TInner>]>,
    ): Queryable<StandardType<TResult>>;

    orderBy<TKey>(
        key: Func<TKey, [SchemaType<TElement>]>,
    ): Queryable<TElement>;

    orderByDescending<TKey>(
        key: Func<TKey, [SchemaType<TElement>]>,
    ): Queryable<TElement>;

    thenBy<TKey>(
        key: Func<TKey, [SchemaType<TElement>]>,
    ): Queryable<TElement>;

    thenByDescending<TKey>(
        key: Func<TKey, [SchemaType<TElement>]>,
    ): Queryable<TElement>;

    distinct(): Queryable<TElement>;

    groupBy<TKey, TMapped = undefined, TResult = undefined>(
        key: Func<TKey, [SchemaType<TElement>]>,
        element?: Func<TMapped, [SchemaType<TElement>]>,
        result?: Func<TResult, [TKey, Queryable<TMapped extends undefined ? SchemaType<TElement> : TMapped>]>,
        args?: Serializable,
    ): GroupResult<TElement, TMapped, TResult>;

    skip(count: number): Queryable<TElement>;
    take(count: number): Queryable<TElement>;

    firstOrDefault(): TElement;
    singleOrDefault(): TElement;

    sum(
        field: Func<number, [SchemaType<TElement>]>
    ): number;

}

async function singleItem<TElement>(query: Queryable<TElement>) {
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

    return result;
}