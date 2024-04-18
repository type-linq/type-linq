import {
    Expression as QueryExpression,
    Type,
    isScalar,
} from '@type-linq/query-tree';

import { Expression, ExpressionTypeKey } from '../type.js';
import { expressionRoot, walkLeaf } from '../walk.js';

export type Globals = {
    hasIdentifier(basePath: string): boolean;
    mapIdentifier(path: string[], args?: QueryExpression[]): QueryExpression | undefined;
    mapAccessor(type: Type, object: QueryExpression, name: string | symbol, args: QueryExpression[]): QueryExpression | undefined;
    mapHandler(handler: string, args?: QueryExpression[]): QueryExpression | undefined;
};

export function mapGlobalIdentifier(expression: Expression<`MemberExpression` | `Identifier`>, globals: Globals, args?: QueryExpression[]): QueryExpression {
    const source = expressionRoot(expression);
    if (!isGlobalIdentifier(source, globals)) {
        throw new Error(`Expected an expression with a global at it's source to be supplied`);
    }

    const path: string[] = [];
    walkLeaf(expression, (exp) => {
        if (exp.type === `Identifier`) {
            path.push(exp.name as string);
        }
    });

    const exp = globals.mapIdentifier(path, args);

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

    const global = globals.hasIdentifier(source.name);
    return Boolean(global);
}

export function mapGlobalAccessor(
    object: QueryExpression,
    name: string,
    args: QueryExpression[],
    globals?: Globals
) {
    if (!globals) {
        return undefined;
    }

    if (!object.type[name] || !isScalar(object.type[name] as Type)) {
        throw new Error(`Can only map global accessors to scalar types`);
    }

    const exp = globals.mapAccessor(object.type, object, name, args);
    return exp;    
}
