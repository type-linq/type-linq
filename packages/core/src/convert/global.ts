import { CallExpression } from '../tree/call';
import { GlobalExpression } from '../tree/global';
import { Expression as QueryExpression } from '../tree/expression';
import { Type, isScalar } from '../tree/type';
import { Expression, ExpressionTypeKey } from '../type';
import { expressionRoot, walkLeaf } from '../walk';
import { readName } from './util';

export type Globals = {
    // TODO: We have no way to exclude identifiers!
    mapIdentifier(...path: string[]): GlobalExpression | undefined;
    mapAccessor(type: Type, object: QueryExpression<string>, name: string | symbol, args: QueryExpression<string>[]): GlobalExpression | CallExpression | undefined;
};

export function mapGlobal(expression: Expression<`MemberExpression` | `Identifier`>, globals: Globals): GlobalExpression {
    const source = expressionRoot(expression);
    if (!isGlobalIdentifier(source, globals)) {
        throw new Error(`Expected an expression with a global at it's source to be supplied`);
    }

    const path: string[] = [];
    walkLeaf(expression, (exp) => {
        if (exp.type === `Identifier`) {
            path.push(exp.name as string);
        } else if (exp.type === `MemberExpression`) {
            const name = readName(exp.property);
            path.push(name as string);
        } else {
            throw new Error(
                `Unexpected Expression type "${exp.type}" received (Expected ` +
                    `Identifier or MemberExpression)`
            );
        }
    });

    const exp = globals.mapIdentifier(...path);

    if (exp === undefined) {
        throw new Error(`Unable to find global ${path.join(`.`)}`);
    }

    return exp;
}

export function isGlobalIdentifier(expression: Expression<ExpressionTypeKey>, globals?: Globals) {
    // TODO: We must exclude global identifiers whose names exist in scope
    //  of the functions
    // (i.e. if we have a parameter named "x" we should not allow a global identifier "x" since it should be scoped to the parameterss)
    // This should be done in the consumer... it should not pass in identifiers which cannot be used...

    if (!globals || typeof globals !== `object`) {
        return false;
    }

    const source = expressionRoot(expression);
    if (source.type !== `Identifier`) {
        return false;
    }

    if (typeof source.name !== `string`) {
        return false;
    }

    const global = globals.mapIdentifier(source.name);
    return Boolean(global);
}

export function mapGlobalAccessor(
    object: QueryExpression<string>,
    name: string | symbol,
    args: QueryExpression<string>[],
    globals?: Globals
) {
    if (!globals) {
        return undefined;
    }

    if (!isScalar(object.type)) {
        throw new Error(`Can only map global accessors to scalar types`);
    }

    const exp = globals.mapAccessor(object.type, object, name, args);
    return exp;    
}