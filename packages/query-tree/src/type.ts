export type Type = StringType | NumberType | BooleanType | NullType | DateType | EntityType | UnionType | FunctionType;

export const UNION_TYPES = Symbol(`union-types`);

export type TypeFunction = () => Type;

export class StringType {
    [name: string]: TypeFunction | Type | undefined;

    get length() {
        return new NumberType();
    }

    startsWith() {
        return new BooleanType();
    }

    endsWith() {
        return new BooleanType();
    }

    includes() {
        return new BooleanType();
    }

    trimStart() {
        return new StringType();
    }

    trimEnd() {
        return new StringType();
    }

    replace() {
        return new StringType();
    }

}

export class NumberType {
    [name: string]: TypeFunction | Type | undefined;

    toString() {
        return new StringType();
    }
}

export class BooleanType {
    [name: string]: TypeFunction | Type | undefined;

    toString() {
        return new StringType();
    }
}

export class DateType {
    [name: string]: TypeFunction | Type | undefined;

    toString() {
        return new StringType();
    }

    valueOf() {
        return new NumberType();
    }
}

export class BinaryType {
    [name: string]: TypeFunction | Type | undefined;
}

export class NullType {
    [name: string]: TypeFunction | Type | undefined;
}

export class FunctionType {
    [name: string]: Type | undefined;
    returnType: Type;

    constructor(returnType: Type) {
        this.returnType = returnType;
    }
}

export type Fields = {
    [name: string]: Type;
}

export class EntityType {
    [name: string]: Type | undefined;

    constructor(fields: Fields) {
        Object.assign(this, fields);
        return this as EntityType;
    }
}

export class UnionTypeProxy {
    constructor(...types: Type[]) {
        return new Proxy({}, {
            ownKeys() {
                return unionTypeKeys(types);
            },
            get(_, name) {
                if (typeof name === `symbol`) {
                    return undefined;
                }

                const resultTypes: Type[] = [];
                walkUnion(types, (type) => {
                    if (type instanceof FunctionType || Object.hasOwn(type, name) === false) {
                        throw new Error(`Type "${type.constructor.name}" does not have a property named "${name}"`);
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const value = (type as any)[name];
                    if (typeof value === `function`) {
                        resultTypes.push(
                            new FunctionType(
                                value()
                            )
                        );
                    } else {
                        resultTypes.push(value);
                    }
                });
            },
            set() {
                throw new Error(`Set not supported`);
            }
        });
    }
}

export class UnionType extends UnionTypeProxy {
    [UNION_TYPES]: Type[];
    [name: string]: TypeFunction | Type | undefined;

    constructor(...types: Type[]) {
        const unique = UnionType.unique(...types);
        super(...unique);
        this[UNION_TYPES] = unique;
    }

    static possibleUnion(...types: Type[]) {
        if (types.length === 0) {
            throw new Error(`MUST supply at least one type`);
        }
        const unique = UnionType.unique(...types);
        if (unique.length === 1) {
            return unique[0];
        }
        return new UnionType(...unique);
    }

    private static unique(...types: Type[]) {
        const unique = types.filter(
            (ele, idx, arr) => arr.findIndex((item) => isEqual(item, ele)) === idx
        );
        return unique;
    }
}

export const scalarUnion = new UnionType(
    new BooleanType(),
    new StringType(),
    new NumberType(),
    new NullType(),
    new DateType(),
);

export function isScalar(type: Type): boolean {
    if (type instanceof EntityType === true) {
        return false;
    }

    if (type instanceof UnionType) {
        return type[UNION_TYPES].every(isScalar);
    }

    return true;
}

export function isEntity(type: Type): boolean {
    if (type instanceof EntityType === true) {
        return true;
    }

    if (type instanceof UnionType) {
        return type[UNION_TYPES].every(isScalar);
    }

    return false;
}

export function isMixed(type: Type): boolean {
    return !isScalar(type) && !isEntity(type);
}

export function walkUnion(type: Type | Type[], visitor: (type: Type) => void) {
    if (Array.isArray(type)) {
        type.forEach((type) => walkUnion(type, visitor));
    } else if (type instanceof UnionType) {
        type[UNION_TYPES].forEach((type) => walkUnion(type, visitor));
    } else {
        visitor(type);
    }
}

export function isEqual(t1: Type, t2: Type) {
    switch (true) {
        case t1 instanceof EntityType: {
            const e1 = t1 as EntityType;
            const e2 = t2 as EntityType;

            if (Object.keys(e1).length !== Object.keys(e2).length) {
                return false;
            }

            for (const [name, e1Type] of Object.entries(e1)) {
                const e2Type = e2[name];
                if (e2Type === undefined) {
                    return false;
                }

                if (isEqual(e1Type!, e2Type) === false) {
                    return false;
                }
            }

            return true;
        }
        case t1 instanceof UnionType: {
            const u1 = t1 as UnionType;
            const u2 = t2 as UnionType;

            if (u1[UNION_TYPES].length !== u2[UNION_TYPES].length) {
                return false;
            }

            const u2Types = u2[UNION_TYPES].slice();

            for (const u1Type of u1[UNION_TYPES]) {
                for (let index = 0; index < u2Types.length; index++) {
                    const u2Type = u2Types[index];

                    if (isEqual(u1Type, u2Type)) {
                        u2Types.splice(index, 1);
                        index--;
                    }
                }
            }

            return u2Types.length === 0;
        }
    }

    return true;

}

function unionTypeKeys(type: Type | Type[]): string[] {
    if (Array.isArray(type)) {
        return type.map(unionTypeKeys).flat();
    } 
    if (type instanceof UnionType) {
        return unionTypeKeys(type[UNION_TYPES]).flat();
    }
    if (type instanceof FunctionType) {
        return [];
    }
    return typeKeys(type);
}

function typeKeys(type: Type) {
    if (type instanceof UnionType) {
        throw new Error(`Unexpected union type`);
    }
    return Object.getOwnPropertyNames(type);
}