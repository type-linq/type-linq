import objectHash from 'object-hash';
import { Column } from '../../core/src/tree/column';
import { Expression } from '../../core/src/tree/expression';
import { SourceExpression } from '../../core/src/tree/source';
import { BinaryType, NumberType, StringType, Type, EntityType } from '../../core/src/tree/type';
import { DatabaseSchema, TableSchema } from './schema';
import { Identifier } from '../../core/src/tree/identifier';
import { asArray } from '../../core/src/tree/util';

export function buildSources(schema: DatabaseSchema) {
    const sources: Record<string, SourceExpression> = {};

    // Add the scalar columns
    for (const [name, table] of Object.entries(schema.tables)) {
        const columns = buildColumns(table);
        sources[name] = new SourceExpression(name, columns);
    }

    //  1. Make all matching entity types the same type object
    const typeCache: Record<string, EntityType> = {};
    for (const table of Object.values(sources)) {
        Expression.walk(table, (exp) => {
            if (exp.type instanceof EntityType === false) {
                return;
            }

            const hash = objectHash(exp.type);
            if (typeCache[hash]) {
                exp.type = typeCache[hash];
            } else {
                typeCache[hash] = exp.type;
            }
        });
    }

    //  2. Add all required link columns
    for (const [name, table] of Object.entries(schema.tables)) {
        const links = buildLinkColumns(sources, table);
        // Note: This will update the entity types directly
        sources[name].addColumns(links);
    }

    //  4. Call link on the sources
    for (const [name, source] of Object.entries(sources)) {
        const table = schema.tables[name];
        for (const link of Object.values(table.links)) {
            source.link(sources[link.table], link.columns);
        }

        for (const column of asArray(source.columns)) {
            if (column.expression instanceof Identifier) {
                column.expression.scope.push(source.name);
            }
        }
    }

    return sources;
}

function buildColumns(schema: TableSchema) {
    const columns = Object.entries(schema.columns).map(
        ([name, dbType]) => {
            let type: Type;
            switch (dbType) {
                case `TEXT`:
                case `TEXT NULL`:
                    type = new StringType();
                    break;
                case `NUMERIC`:
                case `NUMERIC NULL`:
                case `INTEGER`:
                case `INTEGER NULL`:
                case `REAL`:
                case `REAL NULL`:
                    type = new NumberType();
                    break;
                case `BLOB`:
                case `BLOB NULL`:
                    type = new BinaryType();
                    break;
            }

            // Note: This is not scoped, we need to scope it once
            //  the source is created
            const identifier = new Identifier(name, type);
            return new Column(identifier, name);
        }
    );
    return columns;
}

function buildLinkColumns(sources: Record<string, SourceExpression>, schema: TableSchema) {
    const columns = Object.entries(schema.links).map(
        ([name, { table }]) => {
            const source = sources[table];
            if (source === undefined) {
                throw new Error(`Unable to find table "${table}" on sources`);
            }
            return new Column(source, name);
        }
    );
    return columns;
}
