import {
    CallArguments,
    CallExpression,
    CastExpression,
    Expression,
    FunctionType,
    GlobalIdentifier,
    Literal,
    NumberType,
    StringType
} from '@type-linq/query-tree';

export function accessor(object: Expression, name: string | symbol, args: Expression[]) {
    switch (name) {
        case `toString`:
            return new CastExpression(
                object,
                new StringType(),
            );
         case `toExponential`:
            return new CallExpression(
                new StringType(),
                new GlobalIdentifier(
                    `printf`,
                    new FunctionType(new StringType())
                ),
                new CallArguments([new Literal(`%e`), object]),
            );
        default:
            console.debug(`Number accessor`, object, name, args);
            return undefined;
    }
}

export function identifier(path: string[], args: Expression[]) {
    if (path.length === 0) {
        throw new Error(`Received empty path`);
    }

    if (path.length !== 1) {
        throw new Error(`Unknown global "Number.${path.join(`.`)}"`);
    }

    switch (path[0]) {
        case `parseInt`:
        case `parseFloat`:
            if (args.length !== 1) {
                throw new Error(`Expected exactly one argument to be passed to "${path[0]}"`);
            }
            return new CastExpression(
                args[0],
                new NumberType(),
            );
        default:
            throw new Error(`Number.${path[0]} is not supported`);
    }
}
