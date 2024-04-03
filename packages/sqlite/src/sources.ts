import {
    BinaryType,
    NumberType,
    StringType,
    EntityIdentifier,
    EntityType,
    EntitySource,
    TypeFields,
    Field,
    FieldSet,
    FieldIdentifier,
    LogicalExpression,
    BinaryExpression,
    Literal,
    LinkedEntitySource,
    Type,
    WhereClause,
} from '@type-linq/query-tree';

import { DatabaseSchema } from './schema.js';

export function buildSources(schema: DatabaseSchema) {
    const entityTypes: Record<string, EntityType> = {};
    const entities: Record<string, EntityIdentifier> = {};
    const sources: Record<string, EntitySource> = {};

    // TODO: We need select expressions onto fields...
    //  Why? Why can't we handle jus an entity source...
    
    for (const table of Object.values(schema.tables)) {
        const fields: TypeFields = {};

        for (const [name, { type: dbType }] of Object.entries(table.columns)) {
            fields[name] = createType(dbType);
        }

        for (const [linkName, { table: tbl }] of Object.entries(table.links)) {
            fields[linkName] = () => entityTypes[tbl];
        }

        const type = new EntityType(fields);
        entityTypes[table.name] = type;
    }


    for (const [name, table] of Object.entries(schema.tables)) {
        const fields: Field[] = [];

        const entity = new EntityIdentifier(
            table.name,
            entityTypes[table.name],
        );
        entities[table.name] = entity;

        for (const [name, column] of Object.entries(table.columns)) {
            fields.push(
                new Field(
                    new FieldIdentifier(
                        () => sources[table.name],
                        column.name,
                        createType(column.type),
                    ),
                    name,
                )
            );
        }

        for (const [linkName, { table: tableName, columns }] of Object.entries(table.links)) {
            const clause = Object.entries(columns).reduce<WhereClause | undefined>((result, [sourceName, joinedName]) => {
                const comparison = new BinaryExpression(
                    new FieldIdentifier(() => sources[table.name], sourceName, () => sources[table.name].type[sourceName] as Type),
                    `==`,
                    new FieldIdentifier(() => sources[tableName], joinedName, () => sources[tableName].type[joinedName] as Type),
                );

                if (result === undefined) {
                    return comparison;
                }

                return new LogicalExpression(result, `&&`, comparison);
            }, undefined);

            const linkedSource = new LinkedEntitySource(
                () => sources[table.name],
                () => sources[tableName].boundary(),
                clause || new BinaryExpression(
                    new Literal(1),
                    `==`,
                    new Literal(1),
                ),
            );

            fields.push(
                new Field(
                    linkedSource,
                    linkName,
                )
            );
        }

        const source = new EntitySource(
            entity,
            new FieldSet(fields, () => entityTypes[table.name]),
        );
        sources[name] = source;
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