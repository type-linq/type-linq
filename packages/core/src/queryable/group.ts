import { FieldSet, GroupExpression, SelectExpression, Source, Walker } from '@type-linq/query-tree';
import { Expression as AstExpression, Serializable } from '../type.js';
import { processKey } from './util.js';
import { transformSelect, transformSource } from './select.js';
import { QueryProvider } from '../query-provider.js';
import { QueryableEmbedded } from './queryable.js';


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
        provider,
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
            provider,
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

        const fieldSet = transformSelect(
            [keySelect, new QueryableEmbedded(provider, elementSource)],
            elementAst!,
            provider,
            args,
        );
        return transformSource(elementSource, fieldSet);
    }

    // TODO: This is wrong... it's not just a select transform,
    //  we need to ingest the source (there may be things like where)
    // But how... we need the final result of the second parameter
    //  then we need to ingest whatever happens there....

    // TODO: This could happen on a standard field as well...
    //  Think... Supplier.Products.where((c) => ...)
    //  That means the select transform has to be able to handle it....
    //     which means we need some access to the source during the transform
    //      to apply the values... 

    // But... we actually don't want this to happen automatically...
    //  We if we have a field defined, but some subsequent select discarss that
    //  field, we don't want th sub query parts (in the same way we do linked entities)
    //  THis means the transform select needs to get the entire field value, and we need to
    //      process it in the compile step...

    const fieldSet = transformSelect(
        [keySelect, new QueryableEmbedded(provider, elementSource ?? groupBy)],
        resultAst,
        provider,
        args,
    );

    return transformSource(elementSource ?? groupBy, fieldSet);
}
