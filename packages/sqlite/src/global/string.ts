import {
    CallArguments,
    CallExpression,
    Expression,
    FunctionType,
    GlobalIdentifier,
    MatchExpression,
    NumberType,
    StringType
} from '@type-linq/query-tree';

export function accessor(object: Expression, name: string | symbol, args: Expression[]) {
    switch (name) {
        case `toString`:
            return object;
        case `length`:
            return new CallExpression(
                new NumberType(),
                new GlobalIdentifier(`length`, new FunctionType(new NumberType())),
                new CallArguments([object])
            );
        case `startsWith`:
            if (args.length !== 1) {
                throw new Error(`Expected exactly one argument to startsWith`);
            }
            return new MatchExpression(
                object,
                `start`,
                args[0],
            );
        case `endsWith`:
            if (args.length !== 1) {
                throw new Error(`Expected exactly one argument to endsWith`);
            }
            return new MatchExpression(
                object,
                `end`,
                args[0],
            );
        case `includes`:
            if (args.length !== 1) {
                throw new Error(`Expected exactly one argument to includes`);
            }
            return new MatchExpression(
                object,
                `in`,
                args[0],
            );
        case `trim`:
            if (args.length !== 0) {
                throw new Error(`Expected trim to take no arguments`);
            }
            return new CallExpression(
                new NumberType(),
                new GlobalIdentifier(`trim`, new FunctionType(new StringType())),
                new CallArguments([object])
            );
        case `trimStart`:
            if (args.length !== 0) {
                throw new Error(`Expected trimStart to take no arguments`);
            }
            return new CallExpression(
                new NumberType(),
                new GlobalIdentifier(`ltrim`, new FunctionType(new StringType())),
                new CallArguments([object])
            );
        case `trimEnd`:
            if (args.length !== 0) {
                throw new Error(`Expected trimEnd to take no arguments`);
            }
            return new CallExpression(
                new NumberType(),
                new GlobalIdentifier(`rtrim`, new FunctionType(new StringType())),
                new CallArguments([object])
            );
        case `replace`:
            if (args.length !== 2) {
                throw new Error(`Expected replace to take 2 arguments`);
            }
            return new CallExpression(
                new NumberType(),
                new GlobalIdentifier(`replace`, new FunctionType(new StringType())),
                new CallArguments([object, args[0], args[1]])
            );
        default:
            console.debug(`String accessor`, object, name, args);
            return undefined;
    }
}


export function identifier(path: string[], args: Expression[]) {
    if (path.length === 0) {
        throw new Error(`Received empty path`);
    }

    if (path.length !== 1) {
        throw new Error(`Unknown global "String.${path.join(`.`)}"`);
    }

    switch (path[0]) {
        case `fromCharCode`:
            if (args.length !== 1) {
                throw new Error(`Expected exactly one argument to be passed to "${path[0]}"`);
            }
            return new CallExpression(
                new StringType(),
                new GlobalIdentifier(
                    `char`,
                    new FunctionType(new StringType())
                ),
            );
        default:
            throw new Error(`Number.${path[0]} is not supported`);
    }
}
