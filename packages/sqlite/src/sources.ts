import {
    BinaryType,
    NumberType,
    StringType,
    FromExpression,
    EntityIdentifier,
    LinkField,
    EntityType,
} from '@type-linq/query-tree';

import { DatabaseSchema } from './schema.js';

export function buildSources(schema: DatabaseSchema) {
    const sources: Record<string, FromExpression> = {};

    // Add the scalar columns
    for (const [name, table] of Object.entries(schema.tables)) {
        const type = new EntityType(
            Object.fromEntries(
                Object.entries(table.columns).map(
                    ([name, dbType]) => [name, createType(dbType)]
                )
            )
        );

        const entity = new EntityIdentifier(table.name, type);
        const from = new FromExpression(entity);
        sources[name] = from;

        for (const [name] of Object.entries(table.columns)) {
            from.scalar(name);
        }
    }

    // Add the links
    for (const [name, table] of Object.entries(schema.tables)) {
        for (const [linkName, { table: tbl, columns }] of Object.entries(table.links)) {
            const linkFields: LinkField[] = Object.entries(columns).map(([sourceName, joinedName]) => {
                return {
                    joinedName,
                    sourceName,
                }
            });

            sources[name].link(
                linkName,
                sources[tbl],
                linkFields,
            );
        }
    }

    return sources;
}

function createType(dbType: string) {
    switch (dbType) {
        case `TEXT`:
        case `TEXT NULL`:
            return new StringType();
        case `NUMERIC`:
        case `NUMERIC NULL`:
        case `INTEGER`:
        case `INTEGER NULL`:
        case `REAL`:
        case `REAL NULL`:
            return new NumberType();
        case `BLOB`:
        case `BLOB NULL`:
            return new BinaryType();
        default:
            throw new Error(`Unknown db type "${dbType}" received`);
    }
}