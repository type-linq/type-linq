import { Field, FieldSet, Source } from '@type-linq/query-tree';
import { Expression, Serializable } from '../type.js';
import { QueryProvider } from '../query-provider.js';
import { processKey } from './util.js';
import { transformSource } from './select.js';

export function sum(
    provider: QueryProvider,
    source: Source,
    fieldAst: Expression<`ArrowFunctionExpression`>,
    args?: Serializable,
) {
    const field = processKey(
        args,
        provider,
        fieldAst,
        source,
    );

    if (Array.isArray(field)) {
        throw new Error(`Expected single scalar field to be returned`);
    }

    const expression = provider.globals.mapHandler(`sum`, [field.expression]);
    if (expression === undefined) {
        throw new Error(`Unable to map the sum handler`);
    }

    const result = transformSource(
        source,
        new FieldSet(
            new Field(
                expression,
                field.name.name,
            )
        ),
    );
    return result;
}
