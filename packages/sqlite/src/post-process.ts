import { BooleanType, DateType, NumberType, Source, StringType } from '@type-linq/query-tree';

const UNIX_EPOCH = 2_440_587.5; // In Julian day format
const ONE_DAY_MS = 86_400_000;

export function postProcess(expression: Source) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return function convert(result: any) {
        if (result === null || typeof result !== `object`) {
            throw new Error(`Expected result to be an object`);
        }

        for (const field of expression.fieldSet) {
            switch (true) {
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