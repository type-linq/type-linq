import {
    CastExpression,
    Expression,
    StringType
} from '@type-linq/query-tree';

export function accessor(object: Expression, name: string | symbol, args: Expression[]) {
    switch (name) {
        case `toString`:
            return new CastExpression(
                object,
                new StringType(),
            );
        default:
            console.debug(`Boolean accessor`, object, name, args);
            return undefined;
    }
}
