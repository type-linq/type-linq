import { CallArguments, CallExpression, Expression, FunctionType, GlobalIdentifier, NumberType } from '@type-linq/query-tree';

export function identifier(path: string[], args?: Expression[]) {
    if (path.length === 0) {
        throw new Error(`Received empty path`);
    }

    if (path.length !== 1) {
        throw new Error(`Unknoen global "Math.${path.join(`.`)}"`);
    }

    const global = createGlobal(path[0]);
    if (args === undefined) {
        return global;
    }

    return new CallExpression(
        new NumberType(),
        global,
        new CallArguments(args),
    );
}

function createGlobal(path: string) {
    switch (path) {
        case `abs`:
        case `acos`:
        case `acosh`:
        case `asin`:
        case `asinh`:
        case `atan`:
        case `atan2`:
        case `atanh`:
        case `ceil`:
        case `cos`:
        case `cosh`:
        case `exp`:
        case `floor`:
        case `log`:
        case `log10`:
        case `log2`:
        case `max`:
        case `min`:
        case `pow`:
        case `random`:
        case `round`:
        case `sin`:
        case `sinh`:
        case `sqrt`:
        case `tan`:
        case `tanh`:
        case `trunc`:
            return new GlobalIdentifier(path, new FunctionType(new NumberType()));
        case `cbrt`:
        case `clz32`:
        case `expm1`:
        case `hypot`:
        case `imul`:
        case `log1p`:
        case `fround`:
        case `sign`:
        default:
            throw new Error(`Math.${path} is not supported`);
    }
}