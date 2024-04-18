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

import { DatabaseSchema, TableSchema } from './schema.js';
import { randString } from './util.js';
import { LateBound } from '@type-linq/query-tree/dist/src/util.js';

export function buildSources(schema: DatabaseSchema) {
    const sources: Record<string, EntitySource> = {};

    // TODO: We need to identify many to many relationships...
    //  We can assume a many to many relatonship is a table where
    //  every column is a foreign key, and all foreign keys
    //  point to exactly 2 tables....

    // TODO: Views!

    const linkTables: TableSchema[] = [];
    for (const [name, table] of Object.entries(schema.tables)) {
        // TODO: Determine link tables....
    }

    // TODO: We are missing reverse links...

    for (const [name, table] of Object.entries(schema.tables)) {
        const linkTable = linkTables.find((table) => table.name === table.name);
        if (linkTable) {
            continue;
        }

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

        for (const [linkName, link] of Object.entries(table.links)) {
            const boundaryId = randString();

            const linked = buildLink(
                boundaryId,
                sources,
                table.name,
                link.table,
                link.columns,
                link.many,
            );

            fields.push(
                new Field(
                    linked,
                    linkName,
                )
            );

            // TODO: We don't have a good way to define the name on the remote linked....
            // TODO: The remote table may not exist yet....
            // TODO: Think we need to add this to the schema....
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

function buildLink(
    boundaryId: string,
    sources: Record<string, EntitySource>,
    tableName: string,
    linkTableName: string,
    columns: Record<string, string>,
    many?: boolean,
) {
    const source = () => sources[tableName];
    const linked: () => LinkedEntity = () => new LinkedEntity(
        () => new Boundary(sources[linkTableName], boundaryId),
        () => sources[tableName],
        () => clause!,
    );

    const clause = buildLinkClause(
        source,
        linked,
        sources,
        tableName,
        linkTableName,
        columns,
    );

    const linkedSource = new LinkedEntity(
        () => new Boundary(sources[linkTableName], boundaryId),
        source,
        clause,
        many,
    );

    return linkedSource;
}

function buildLinkClause(
    source: LateBound<EntitySource>,
    linked: LateBound<EntitySource>,
    sources: Record<string, EntitySource>,
    tableName: string,
    linkTableName: string,
    columns: Record<string, string>,
) {
    const clause = Object.entries(columns).reduce<WhereClause | undefined>((result, [sourceName, joinedName]) => {
        const sourceType = () => sources[tableName].type[sourceName] as Type;
        const linkedType = () => sources[linkTableName].type[joinedName] as Type;

        const left = new FieldIdentifier(source, sourceName, sourceType);
        const right = new FieldIdentifier(linked, joinedName, linkedType);
        const comparison = new BinaryExpression(left, `==`, right);

        if (result === undefined) {
            return comparison;
        }

        return new LogicalExpression(result, `&&`, comparison);
    }, undefined);
    return clause ?? new BinaryExpression(new Literal(1), `==`, new Literal(1));
}