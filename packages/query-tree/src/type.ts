import { FieldSet } from './source/field.js';

export type Type = StringType | NumberType | BooleanType | DateType | EntityType | UnionType | FunctionType | UnknownType;

export const UNION_TYPES = Symbol(`union-types`);

export const TYPE_IDENTIFIER = Symbol(`string-type`);

export class UnknownType {
    readonly [name: string]: Type | undefined;
}

export class StringType {
    readonly [TYPE_IDENTIFIER]: `string` = `string`;
    readonly [name: string]: Type | undefined;

    get length() { return new NumberType(); }
    get startsWith() { return  new FunctionType(new BooleanType()) }
    get endsWith() { return  new FunctionType(new BooleanType()) }
    get includes() { return  new FunctionType(new BooleanType()) }
    get trim() { return  new FunctionType(new StringType()) }
    get trimStart() { return  new FunctionType(new StringType()) }
    get trimEnd() { return  new FunctionType(new StringType()) }
    get replace() { return  new FunctionType(new StringType()) }
}

export class NumberType {
    readonly [TYPE_IDENTIFIER]: `number` = `number`;
    readonly [name: string]: Type | undefined;

    get toString() { return new FunctionType(new StringType()) }
    get toExponential() { return new FunctionType(new NumberType()) }
    get toFixed() { return new FunctionType(new NumberType()) }
    get toPrecision() { return new FunctionType(new NumberType()) }
}

export class BooleanType {
    readonly [TYPE_IDENTIFIER]: `boolean` = `boolean`;
    readonly [name: string]: Type | undefined;
    get toString() { return new FunctionType(new StringType()) }
}

export class DateType {
    readonly [TYPE_IDENTIFIER]: `date` = `date`;
    readonly [name: string]: Type | undefined;
    get toString() { return new FunctionType(new StringType()) }
}

export class BinaryType {
    readonly [TYPE_IDENTIFIER]: `binary` = `binary`;
    readonly [name: string]: Type | undefined;
}

export class FunctionType {
    readonly [TYPE_IDENTIFIER]: `function` = `function`;
    readonly [name: string]: Type | undefined;
    returnType: Type;

    constructor(returnType: Type) {
        this.returnType = returnType;
    }
}

export class EntityType {
    readonly [TYPE_IDENTIFIER]: `entity` | `entitySet` = `entity`;
    readonly [name: string]: Type | undefined;
    readonly [name: symbol]: unknown;

    constructor(fieldSet: FieldSet) {
        const fields = fieldSet.fields;
        return new Proxy(this, {
            ownKeys() {
                return fields.map((field) => field.name.name);
            },

            get(target, name) {
                if (typeof name === `symbol`) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return target[name];
                }

                const field = fields.find(
                    (field) => field.name.name === name
                );

                if (field === undefined && name === `constructor`) {
                    return EntityType;
                }

                if (field === undefined) {
                    return undefined;
                }

                return field.type;
            },

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            set(target: any, name, value) {
                target[name] = value;
                return true;
            }
        });
    }
}

export class EntitySet extends EntityType {
    readonly [TYPE_IDENTIFIER]: `entity` | `entitySet` = `entitySet`;

    constructor(fieldSet: FieldSet) {
        super(fieldSet);

        // TODO: We actually need a Proxy here since we don't want to
        //  overwrite columns with functions
    }

    // TODO
}

export class UnionTypeProxy {
    readonly [TYPE_IDENTIFIER]: `union` = `union`;
    constructor(...types: Type[]) {
        return new Proxy(this, {
            ownKeys() {
                return unionTypeKeys(types);
            },
            get(target, name) {
                if (typeof name === `symbol`) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return (target as any)[name];
                }

                const resultTypes: Type[] = [];
                walkUnion(types, (type) => {
                    if (type instanceof FunctionType || Object.hasOwn(type, name) === false) {
                        throw new Error(`Type "${type.constructor.name}" does not have a property named "${name}"`);
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const value = (type as any)[name];
                    resultTypes.push(value);
                });
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            set(target: any, name, value) {
                target[name] = value;
                return true;
            }
        });
    }
}

export class UnionType extends UnionTypeProxy {
    [UNION_TYPES]: Type[];
    readonly [name: string]: Type | undefined;

    constructor(...types: Type[]) {
        const unique = UnionType.unique(...types);
        super(...unique);
        this[UNION_TYPES] = unique;
    }

    static allTypes(type: Type): Type[] {
        if (type instanceof UnionType === false) {
            return [type];
        }
        return type[UNION_TYPES].map(UnionType.allTypes).flat();
    }

    static possibleUnion(...types: Type[]) {
        if (types.length === 0) {
            throw new Error(`MUST supply at least one type`);
        }

        const all = types.map(UnionType.allTypes).flat();
        const unique = UnionType.unique(...all);
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

    return Object.getPrototypeOf(t1) === Object.getPrototypeOf(t2);

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
