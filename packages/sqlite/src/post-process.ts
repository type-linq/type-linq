/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    BooleanType,
    DateType,
    NumberType,
    Source,
    StringType,
    EntitySet,
    UnionType,
    UnknownType,
    isScalar,
    EntityType,
} from '@type-linq/query-tree';

const UNIX_EPOCH = 2_440_587.5; // In Julian day format
const ONE_DAY_MS = 86_400_000;

export function postProcess(expression: Source) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return function convert(result: any) {
        if (result === null || typeof result !== `object`) {
            throw new Error(`Expected result to be an object`);
        }

        for (const field of expression.fieldSet) {
            if (result[field.name.name] === undefined) {
                continue;
            }
            switch (true) {
                case result[field.name.name] === undefined:
                case result[field.name.name] === null:
                    break;
                case field.type instanceof BooleanType:
                    result[field.name.name] = Boolean(result[field.name.name]);
                    break;
                case field.type instanceof StringType:
                    result[field.name.name] = String(result[field.name.name]);
                    break;
                case field.type instanceof NumberType:
                    result[field.name.name] = parseFloat(String(result[field.name.name]));
                    break;
                case field.type instanceof DateType:
                    if (typeof result[field.name.name] === `number`) {
                        result[field.name.name] = (result[field.name.name] - UNIX_EPOCH) * ONE_DAY_MS;
                    } else {
                        result[field.name.name] = new Date(result[field.name.name]);
                    }
                    break;
                default:
                    break;
            }
        }

        if (expression.fieldSet.scalar) {
            return result[expression.fieldSet.field.name.name];
        }

        return result;
    }
}

// TODO: Surely this won't work on a series of values...
//  For example... we may do something
//      like suppliers.Products.UnitsInStock
//          and want all the unit values back, but they will be squashed if they are the
//          same and happen to be next to each other!
//  Need to think of remedies....
//      Probably need to force a primary key (where there is no group expression)
//      and use row number for group expressions...
//      row_number() over (order by <query order expressions>)

export function unflatten(rows: unknown[], source: Source) {
    return processRows(rows, source);
}

export function unflattenRows(rows: unknown[], source: Source) {
    return Array.from(processRows(rows, source));
}

function *processRows(rows: any[], source: Source, parent?: string) {
    for (let index = 0; index < rows.length; index++) {
        // Get the window for the data
        const start = index;
        while (rowMatches(rows[start], rows[index + 1], source, parent)) {
            index++;
        }

        // Create the object
        yield createRowValue(rows.slice(start, index + 1), source, parent);
    }
}

function createRowValue(rows: any[], expression: Source, parent?: string) {
    if (rows.length === 0) {
        return undefined;
    }

    if (rows[0] && typeof rows[0] === `object`) {
        return createObject(rows, expression, parent);
    }

    return rows[0];
}

function createObject(rows: any[], expression: Source, parent?: string) {
    if (rows.length === 0) {
        return undefined;
    }

    const object = createBaseObject(rows[0], expression, parent);

    for (const field of expression.fieldSet) {
        if (isScalar(field.type)) {
            // We've already covered this in createBaseObject
            continue;
        }

        if (field.expression instanceof Source === false) {
            throw new Error(`Expected field.expression to be a Source`);
        }

        const fieldName = parent ?
            `${parent}.${field.name.name}` :
            field.name.name;

        if (Object.keys(rows[0]).find((key) => key.startsWith(fieldName)) === undefined) {
            continue;
        }

        switch (true) {
            case field.type instanceof UnionType:
                throw new Error(`not implemented`);
            case field.type instanceof UnknownType:
                throw new Error(`Received unexpected UnknownType`);
            case field.type instanceof EntitySet: {
                object[field.name.name] = Array.from(
                    processRows(rows, field.expression, fieldName)
                );
            }
            break;
            case field.type instanceof EntityType: {
                let result: any = undefined;
                for (const subRow of processRows(rows, field.expression, fieldName)) {
                    if (result !== undefined) {
                        throw new Error(`Multiple rows returned for entity`);
                    }
                    result = subRow;
                }
                object[field.name.name] = result;
            }
            break;
            default:
                throw new Error(`Unexpected type "${field.type.constructor.name}" received`);
        }
    }

    return object;
}

function createBaseObject(row: any, expression: Source, parent?: string) {
    const result: any = {};

    for (const field of expression.fieldSet) {
        if (isScalar(field.type) === false) {
            continue;
        }

        const fieldName = parent ?
            `${parent}.${field.name.name}` :
            field.name.name;

        result[field.name.name] = row[fieldName];
    }

    return result;
}

function rowMatches(row1: any, row2: any, expression: Source, parent?: string) {
    if (row1 === row2) {
        return true;
    }

    if (row2 === undefined) {
        return false;
    }

    for (const field of expression.fieldSet) {
        if (isScalar(field.type) === false) {
            continue;
        }

        const fieldName = parent ?
            `${parent}.${field.name.name}` :
            field.name.name;

        if (row1[fieldName] !== row2[fieldName]) {
            return false;
        }
    }

    return true;
}
