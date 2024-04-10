import { BinaryExpression, LogicalExpression, MatchExpression } from '../binary.js';
import { Source } from './source.js';
import { Expression } from '../expression.js';
import { GroupExpression } from './group.js';
import { Walker } from '../walk.js';

export type WhereClause = LogicalExpression | BinaryExpression | MatchExpression;

export class WhereExpression extends Source {
    readonly clause: WhereClause;
    
    get source() {
        return super.source!;
    }

    get fieldSet() {
        return this.source.fieldSet;
    }

    constructor(
        source: Source,
        clause: WhereClause,
    ) {
        super(source);
        this.clause = clause;
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof WhereExpression === false) {
            return false;
        }

        return this.source.isEqual(expression.source) &&
            this.clause.isEqual(expression.clause);
    }

    rebuild(
        source: Source | undefined,
        clause: WhereClause | undefined,
    ): Expression {
        return new WhereExpression(
            source ?? this.source,
            clause ?? this.clause,
        );
    }

    *walk() {
        yield this.source;
        yield this.clause;
    }

    collapse() {
        const whereClauses: WhereClause[] = [];
        const expression = Walker.mapSource(this, (exp) => {
            if (exp instanceof WhereExpression === false) {
                return exp;
            }

            whereClauses.push(exp.clause);
            return exp.source;
        }, undefined, (exp) => exp instanceof GroupExpression);

        const collapsed = whereClauses.reduce<WhereClause | undefined>(
            (result, clause) => {
                if (result === undefined) {
                    return clause;
                } else {
                    return new LogicalExpression(result, `&&`, clause);
                }
            },
            undefined,
        );

        return new WhereExpression(
            expression,
            collapsed!,
        );
    }
}
