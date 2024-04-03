import {
    CallArguments,
    CallExpression,
    Expression,
    FunctionType,
    GlobalIdentifier,
    NumberType,
    StringType
} from '@type-linq/query-tree';

export function accessor(object: Expression, name: string | symbol, args: Expression[]) {
    switch (name) {
        case `toString`:
            return new CallExpression(
                new StringType(),
                new GlobalIdentifier(
                    `datetime`,
                    new FunctionType(new StringType()),
                ),
                new CallArguments([object])
            );
        default:
            console.debug(`Date accessor`, object, name, args);
            return undefined;
    }
}

export function identifier(path: string[]) {
    if (path.length === 0) {
        throw new Error(`Received empty path`);
    }

    if (path.length !== 1) {
        throw new Error(`Unknown global "Number.${path.join(`.`)}"`);
    }

    switch (path[0]) {
        case `now`:
            return new CallExpression(
                new NumberType(),
                new GlobalIdentifier(
                    `julianday`,
                    new FunctionType(new NumberType())
                ),
            );
        default:
            throw new Error(`Date.${path[0]} is not supported`);
    }
}
