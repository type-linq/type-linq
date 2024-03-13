// export 

// TODO: Need string, boolean, integer, float, null
// entity? That's always a source no?

// TODO: How can we represent the types in such a way that they are useful for providers to encode
//  things correctly?

// For example... in sql... if we have string.length, we would need to encode something like len(string)

export type Type = StringType | NumberType | BooleanType | NullType | EntityType<Columns> | UnionType;

export class StringType {
    name = `string`;
    get length() {
        throw new Error(`Not intended to be used directly`);
    }
}

export class NumberType {
    name = `number`;
    toString(): string {
        throw new Error(`Not intended to be used directly`);
    }
}

export class BooleanType {
    name = `boolean`;
    toString(): string {
        throw new Error(`Not intended to be used directly`);
    }
}

export class BinaryType {
    name = `binary`;
}

export class NullType {
    name = `null`;
}

export type Columns = {
    [name: string]: Type;
}

export class EntityType<TColumns extends Columns = Columns> {
    name = `entity`;
    columns: TColumns;

    constructor(columns: TColumns) {
        this.columns = columns;
    }
}

export class UnionType {
    name = `union`;
    types: Type[];

    constructor(...types: Type[]) {
        if (types.length === 0) {
            throw new Error(`MUST supply at least one type`);
        }
        this.types = types.filter(
            (ele, idx, arr) => arr.findIndex((item) => item.name === ele.name) === idx
        );
    }

    static possibleUnion(...types: Type[]) {
        if (types.length === 0) {
            throw new Error(`MUST supply at least one type`);
        }
        const unique = types.filter(
            (ele, idx, arr) => arr.findIndex((item) => item.name === ele.name) === idx
        );
        if (unique.length === 1) {
            return unique[0];
        }
        return new UnionType(...unique);
    }
}

export function isScalar(type: Type): boolean {
    if (type instanceof EntityType === true) {
        return false;
    }

    if (type instanceof UnionType) {
        return type.types.every(isScalar);
    }

    return true;
}

export function isEntity(type: Type): boolean {
    if (type instanceof EntityType === true) {
        return true;
    }

    if (type instanceof UnionType) {
        return type.types.every(isScalar);
    }

    return false;
}

export function walkUnion(type: Type, visitor: (type: Type) => void) {
    if (type instanceof UnionType) {
        type.types.forEach((type) => walkUnion(type, visitor));
    } else {
        visitor(type);
    }
}

export function areTypesEqual(t1: Type, t2: Type) {
    if (t1.name !== t2.name) {
        return false;
    }

    switch (t1.name) {
        case `entity`: {
            const e1 = t1 as EntityType<Columns>;
            const e2 = t2 as EntityType<Columns>;

            if (Object.keys(e1.columns) !== Object.keys(e2.columns)) {
                return false;
            }

            for (const [name, e1Type] of Object.entries(e1.columns)) {
                const e2Type = e2.columns[name];
                if (e2Type === undefined) {
                    return false;
                }

                if (areTypesEqual(e1Type, e2Type) === false) {
                    return false;
                }
            }

            return true;
        }
        case `union`: {
            const u1 = t1 as UnionType;
            const u2 = t2 as UnionType;

            if (u1.types.length !== u2.types.length) {
                return false;
            }

            const u2Types = u2.types.slice();

            for (const u1Type of u1.types) {
                for (let index = 0; index < u2Types.length; index++) {
                    const u2Type = u2Types[index];

                    if (areTypesEqual(u1Type, u2Type)) {
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