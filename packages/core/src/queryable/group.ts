import { Field, FieldSet, GroupExpression, SelectExpression, Source, Walker } from '@type-linq/query-tree';
import { Func, Serializable } from '../type.js';
import { Queryable } from './queryable.js';
import { processKey } from './util.js';
import { parseFunction } from './parse.js';
import { transformSelect, transformSource } from './select.js';


export function groupBy<TElement, TKey, TMapped, TResult>(
    source: Queryable<TElement>,
    key: Func<TKey, [TElement]>,
    element?: Func<TMapped, [TElement]>,
    result?: Func<TResult, [TKey, TMapped]>,
    args?: Serializable,
) {

    Walker.walkSource(source.expression, (exp) => {
        if (exp instanceof GroupExpression) {
            throw new Error(`Cannot call groupBy multiple tmes`);
        }
    });

    const keyAst = parseFunction(key, 1, args);
    const elementAst = element && parseFunction(element, 1, args);
    const resultAst = result && parseFunction(result, 2, args);

    const fields = processKey(
        args,
        source.provider.globals,
        keyAst,
        source.expression,
    );

    const groupBy = new GroupExpression(
        source.expression,
        new FieldSet(fields),
    );

    if (!elementAst && !resultAst) {
        return groupBy;
    }

    let elementSource: Source | undefined = undefined;
    if (elementAst) {
        const fieldSet = transformSelect(
            [groupBy],
            elementAst,
            source.provider.globals,
            args,
        );

        elementSource = transformSource(groupBy, fieldSet);
    }

    const keySelect = new SelectExpression(
        new FieldSet(fields)
    );

    if (!resultAst) {
        if (elementSource === undefined) {
            // We should never have both undefined
            throw new Error(`Invalid program`);
        }

        return transformSource(elementSource, new FieldSet(
            [
                new Field(keySelect, `key`),
                new Field(elementSource, `group`)
            ]
        ));
    }

    const fieldSet = transformSelect(
        [keySelect, elementSource ?? groupBy],
        resultAst,
        source.provider.globals,
        args,
    );

    return transformSource(elementSource || groupBy, fieldSet);
}
