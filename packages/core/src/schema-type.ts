/* eslint-disable @typescript-eslint/no-explicit-any */
import { BooleanType, DateType, NumberType, StringType, TYPE_IDENTIFIER } from '@type-linq/query-tree';
import { Queryable } from './queryable/queryable.js';

export type SchemaType<T> = T extends string
    ? string & StringType
    : T extends number
    ? number & NumberType
    : T extends boolean
    ? boolean & BooleanType
    : T extends Date
    ? Date & DateType
    : T extends object
    ? { [K in keyof T]: SchemaType<T[K]> }
    : T extends [infer TFirst, ...infer TRest]
    ? [SchemaType<TFirst>, ...SchemaType<TRest>]
    : T;

export type StandardType<T> = T extends { [TYPE_IDENTIFIER]: `string` }
    ? string
    : T extends { [TYPE_IDENTIFIER]: `number` }
    ? number
    : T extends { [TYPE_IDENTIFIER]: `boolean` }
    ? boolean
    : T extends { [TYPE_IDENTIFIER]: `date` }
    ? Date
    : T extends object
    ? { [K in keyof T]: StandardType<T[K]> }
    : T extends [infer TFirst, ...infer TRest]
    ? [StandardType<TFirst>, ...StandardType<TRest>]
    : T;
