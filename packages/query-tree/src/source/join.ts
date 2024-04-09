import { Expression } from '../expression.js';
import { Boundary, BoundedEntitySource } from './entity.js';
import { Source } from './source.js';
import { WhereClause } from './where.js';

export class JoinExpression extends Source {
    readonly joined: BoundedEntitySource;
    readonly condition: WhereClause;

    get source() {
        return super.source!;
    }

    get fieldSet() {
        return this.source.fieldSet;
    }

    constructor(
        source: Source,
        joined: Boundary,
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

    rebuild(
        source: Source | undefined,
        joined: Boundary | undefined,
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