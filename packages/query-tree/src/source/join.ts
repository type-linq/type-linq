import { Expression } from '../expression.js';
import { EntityIdentifier } from '../identifier.js';
import { Boundary } from './field.js';
import { Source } from './source.js';
import { SubSource } from './sub.js';
import { WhereClause } from './where.js';

export class JoinExpression extends Source {
    readonly joined: EntityIdentifier | Boundary<EntityIdentifier> | SubSource;
    readonly condition: WhereClause;

    get source() {
        return super.source!;
    }

    get fieldSet() {
        return this.source.fieldSet;
    }

    constructor(
        source: Source,
        joined: EntityIdentifier | Boundary<EntityIdentifier> | SubSource,
        condition: WhereClause,
    ) {
        super(source);
        this.joined = joined;
        this.condition = condition;
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }
        
        if (expression instanceof JoinExpression === false) {
            return  false;
        }

        return this.source.isEqual(expression.source) &&
            this.joined.isEqual(expression.joined) &&
            this.condition.isEqual(expression.condition);
    }

    protected rebuild(
        source: Source | undefined,
        joined: EntityIdentifier | undefined,
        condition: WhereClause | undefined
    ): Expression {
        return new JoinExpression(
            source ?? this.source,
            joined ?? this.joined,
            condition ?? this.condition,
        );
    }

    *walk() {
        yield this.source;
        yield this.joined;
        yield this.condition;
    }

}