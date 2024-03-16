import { Expression, IdentifierExpressionType } from './expression';
import { SourceExpression } from './source/source';
import { EntityType, Type } from './type';

export abstract class Identifier<TType extends IdentifierExpressionType = IdentifierExpressionType> extends Expression<TType> {
    type: Type;
    name: string;

    constructor(name: string, type: Type) {
        super();
        this.name = name;
        this.type = type;
    }

    alias(name: string) {
        return new Alias(this, name);
    }
}

export class EntityIdentifier extends Identifier<`EntityIdentifier`> {
    expressionType = `EntityIdentifier` as const;
}

export class FieldIdentifier extends Identifier<`FieldIdentifier`> {
    expressionType = `FieldIdentifier` as const;
    source: SourceExpression;

    get entity() {
        const from = Expression.source(this.source);
        return from.entity;
    }

    constructor(source: SourceExpression, name: string) {
        if (source.type instanceof EntityType === false) {
            throw new Error(`A FieldIdentifier source cannot be a scalar`);
        }

        if (source.type[name] === undefined) {
            throw new Error(`No field named "${name}" found on type`);
        }

        super(name, source.type[name]!);
        this.source = source;
    }
}

export class GlobalIdentifier extends Identifier<`GlobalIdentifier`> {
    expressionType = `GlobalIdentifier` as const;
}

// TODO: We need to be able to Alias a SourceExpression....

export class Alias<TExpression extends Expression> extends Expression<`Alias`> {
    expressionType = `Alias` as const;
    expression: TExpression;
    
    alias: string;

    get type() {
        return this.expression.type;
    }

    constructor(expression: TExpression, alias: string) {
        super();
        this.expression = expression;
        this.alias = alias;
    }
}
