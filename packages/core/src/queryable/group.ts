import { Field, FieldSet, GroupExpression, SelectExpression, Source, Walker } from '@type-linq/query-tree';
import { Expression as AstExpression, Serializable } from '../type.js';
import { processKey } from './util.js';
import { transformSelect, transformSource } from './select.js';
import { QueryProvider } from '../query-provider.js';


export function groupBy(
    provider: QueryProvider,
    source: Source,
    keyAst: AstExpression<`ArrowFunctionExpression`>,
    elementAst?: AstExpression<`ArrowFunctionExpression`>,
    resultAst?: AstExpression<`ArrowFunctionExpression`>,
    args?: Serializable,
) {
    Walker.walkSource(source, (exp) => {
        if (exp instanceof GroupExpression) {
            throw new Error(`Cannot call groupBy multiple tmes`);
        }
    });

    const fields = processKey(
        args,
        provider.globals,
        keyAst,
        source,
    );

    const groupBy = new GroupExpression(
        source,
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
            provider.globals,
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
        provider.globals,
        args,
    );

    return transformSource(elementSource || groupBy, fieldSet);
}
