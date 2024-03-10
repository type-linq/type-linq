import { DatabaseSchema, TableColumns, TableSchema } from '../schema';
import { BinaryType, EntityType, NumberType, StringType } from './sql-type';

export class SourceEntityType<TTableColumns extends TableColumns = TableColumns> extends EntityType {
    schema: TableSchema<TTableColumns>;

    constructor(schema: TableSchema<TTableColumns>) {
        const properties = Object.entries(schema.columns).map(
            ([name, value]) => {
                return {
                    name,
                    type: scalarType(value),
                }
            }
        );

        super(properties);
        this.schema = schema;
    }

    isLink(name: string) {
        return Object.keys(this.schema.links).includes(name);
    }
}

export function buildTypeTrees<TTableColumns extends TableColumns>(schema: DatabaseSchema<TTableColumns>) {
    const types = Object.fromEntries(
        Object.entries(schema.tables).map(
            ([name, value]) => [name, new SourceEntityType(value)]
        )
    ) as Record<string, EntityType>;

    for (const [name, entity] of Object.entries(types)) {
        addLinks(entity, types, schema.tables[name]);
    }

    return types;
}

function addLinks<TTableColumns extends TableColumns>(entity: EntityType, types: Record<string, EntityType>, table: TableSchema<TTableColumns>) {
    for (const [name, linkInfo] of Object.entries(table.links)) {
        const linkedEntity = types[linkInfo.table];
        if (!linkedEntity) {
            throw new Error(`Unable to find linked entity "${linkInfo.table}" in types`);
        }

        if (entity.accessors[name]) {
            throw new Error(`Entity already has a column named "${name}". Cannot create link`);
        }

        entity.accessors[name] = {
            type: linkedEntity
        };
    }
}

function scalarType(sqlType: string) {
    const type = sqlType.split(` `).shift();
    switch (type) {
        case `TEXT`:
            return new StringType();
        case `NUMERIC`:
        case `INTEGER`:
        case `REAL`:
            return new NumberType();
        case `BLOB`:
        default:
            return new BinaryType();
    }
}
