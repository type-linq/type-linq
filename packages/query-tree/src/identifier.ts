import { Expression, IdentifierExpressionType } from './expression.js';
import { JoinExpression } from './index.js';
import { SourceExpression } from './source/source.js';
import { EntityType, Type } from './type.js';
import { Walker } from './walker.js';

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

    implicitJoins: JoinExpression[];

    get entity() {
        const from = Walker.source(this.source);
        return from.entity;
    }

    constructor(source: SourceExpression, name: string, type?: Type, implicitJoins: JoinExpression[] = []) {
        if (source.type instanceof EntityType === false) {
            throw new Error(`A FieldIdentifier source cannot be a scalar`);
        }

        type = type || readTypeFromSource();

        super(name, type);
        this.source = source;
        this.implicitJoins = implicitJoins;

        function readTypeFromSource() {
            const from = Walker.source(source);
            const entityType = from.entity.type;
    
            if (entityType[name] === undefined) {
                throw new Error(`No field named "${name}" found on type`);
            }

            return entityType[name]!;
        }
    }
}

export class GlobalIdentifier extends Identifier<`GlobalIdentifier`> {
    expressionType = `GlobalIdentifier` as const;
}

// TODO: Perhaps the main issue is that alias is not a source expression....

export class Alias<TExpression extends Expression> extends Expression<`Alias`> {
    expressionType = `Alias` as const;
    expression: TExpression;
    
    alias: string;

    get type() {
        return this.expression.type;
    }

    constructor(expression: TExpression, alias: string) {
        if (expression === undefined) {
            throw new Error(`Expression cannot be undefined`);
        }

        super();
        this.expression = expression;
        this.alias = alias;
    }
}
