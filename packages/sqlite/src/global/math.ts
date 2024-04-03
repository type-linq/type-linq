import { FunctionType, GlobalIdentifier, NumberType } from '@type-linq/query-tree';

export function identifier(path: string[]) {
    if (path.length === 0) {
        throw new Error(`Received empty path`);
    }

    if (path.length !== 1) {
        throw new Error(`Unknoen global "Math.${path.join(`.`)}"`);
    }

    switch (path[0]) {
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
            return new GlobalIdentifier(path[0], new FunctionType(new NumberType()));
        case `cbrt`:
        case `clz32`:
        case `expm1`:
        case `hypot`:
        case `imul`:
        case `log1p`:
        case `fround`:
        case `sign`:
        default:
            throw new Error(`Math.${path[0]} is not supported`);
    }
}
