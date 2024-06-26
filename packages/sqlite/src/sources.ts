import {
    BinaryType,
    NumberType,
    StringType,
    EntitySource,
    Field,
    FieldSet,
    FieldIdentifier,
    LogicalExpression,
    BinaryExpression,
    Literal,
    Type,
    WhereClause,
    LinkedEntity,
    Boundary,
    Entity,
    EntityIdentifier,
    EntityType,
} from '@type-linq/query-tree';

import { DatabaseSchema } from './schema.js';
import { randString } from './util.js';

export function buildSources(schema: DatabaseSchema) {
    const sources: Record<string, EntitySource> = {};

    for (const [name, table] of Object.entries(schema.tables)) {
        const fields: Field[] = [];

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
            const boundaryId = randString();

            const source = () => sources[table.name];
            const linked: () => LinkedEntity = () => new LinkedEntity(
                () => sources[table.name],
                () => new Boundary(sources[tableName], boundaryId),
                () => clause!,
            );

            const clause = Object.entries(columns).reduce<WhereClause | undefined>((result, [sourceName, joinedName]) => {
                const sourceType = () => sources[table.name].type[sourceName] as Type;
                const linkedType = () => sources[tableName].type[sourceName] as Type;

                const left = new FieldIdentifier(source, sourceName, sourceType);
                const right = new FieldIdentifier(linked, joinedName, linkedType);
                const comparison = new BinaryExpression(left, `==`, right);

                if (result === undefined) {
                    return comparison;
                }

                return new LogicalExpression(result, `&&`, comparison);
            }, undefined);

            const linkedSource = new LinkedEntity(
                source,
                () => new Boundary(sources[tableName], boundaryId),
                clause || new BinaryExpression(new Literal(1), `==`, new Literal(1)),
            );

            fields.push(
                new Field(
                    linkedSource,
                    linkName,
                )
            );
        }

        const fieldSet = new FieldSet(fields);
        const source = new Entity(
            new EntityIdentifier(
                table.name,
                fieldSet.type as EntityType
            ),
            fieldSet,
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