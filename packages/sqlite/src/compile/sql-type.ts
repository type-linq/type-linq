export type TypeName = `binary` | `boolean` | `number` | `string` | `entity` | `function`;

export type Accessor = {
    type: Type;
}

export type Property = {
    type: Type;
    name: string;
}

export type Type = {
    name: TypeName;
    accessors: Record<string, Accessor>;
    functions: Record<string, FunctionType>;
    
}

export class FunctionType {
    name = `function` as TypeName;
    type: Type;
    arguments: Type[];

    accessors: Record<string, Accessor> = { };
    functions: Record<string, FunctionType> = { };

    constructor(type: Type, args: Type[] = []) {
        this.type = type;
        this.arguments = args;
    }
}

export class BooleanType {
    name = `boolean` as TypeName;

    accessors: Record<string, Accessor> = {};
    functions: Record<string, FunctionType> = {
        toString: new FunctionType(new StringType()),
    }
}

export class StringType {
    name = `string` as TypeName;
    functions: Record<string, FunctionType> = {
        includes: new FunctionType(new BooleanType(), [new StringType()])
    };
    accessors: Record<string, Accessor> = {
        length: {
            type: new NumberType(),
        }
    };
}

export class NumberType {
    name = `number` as TypeName;
    accessors: Record<string, Accessor> = { };
    functions: Record<string, FunctionType> = {
        toString: new FunctionType(new StringType())
    }   
}

export class BinaryType {
    name = `binary` as TypeName;

    accessors: Record<string, Accessor> = { };
    functions: Record<string, FunctionType> = { };
}

export class EntityType {
    name = `entity` as TypeName;

    source?: EntityType;
    accessors: Record<string, Accessor>;
    functions: Record<string, FunctionType> = { };

    constructor(properties: Property[], source?: EntityType) {
        this.source = source;
        this.accessors = Object.fromEntries(
            properties.map(
                (property) => [property.name, { type: property.type }]
            )
        );
    }
}
