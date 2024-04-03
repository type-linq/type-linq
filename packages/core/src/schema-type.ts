import { BooleanType, DateType, NullType, NumberType, StringType } from '@type-linq/query-tree';

// TODO: Rethink this... Not working as expected....
//  But really need to be able to add the additional
//  prototype functions....?

type SchemaType<T> = T extends object ? {
    [K in keyof T]:
        T[K] extends string
        ? string & StringType
        : T[K] extends number
        ? number & NumberType
        : T[K] extends boolean
        ? boolean & BooleanType
        : T[K] extends Date
        ? Date & DateType
        : T[K] extends null | undefined
        ? NullType
        : SchemaType<T[K]>
} : T;

type StandardType<T> = T extends object ? {
    [K in keyof T]:
        T[K] extends StringType
        ? string
        : T[K] extends NumberType
        ? number
        : T[K] extends BooleanType
        ? boolean
        : T[K] extends DateType
        ? Date
        : T[K] extends NullType
        ? null
        : StandardType<T[K]>
} : T;
