import { FieldIdentifier } from '../identifier.js';
import { JoinExpression } from './join.js';
import { Field, SourceExpression } from './source.js';
import { Walker } from '../walker.js';
import { FromExpression } from './from.js';

export class SelectExpression extends SourceExpression<`SelectExpression`> {
    expressionType = `SelectExpression` as const;
    fields: Field[] | Field;

    get source() {
        return super.source!;
    }

    constructor(
        source: SourceExpression,
        fields: Field[] | Field,
    ) {
        super(source);
        this.fields = fields;
    }

    applyFieldJoins(): SelectExpression {
        const implicitJoins: JoinExpression[] = [];

        // 1. Walk through find every select expression
        // 2. Mutate walk each of the the fields collecting the joins
        //  with their aliases and removing them
        // 3. Search every branch and find the source
        //  Apply all implicit joins for that source to the branch
        //  (ensuring any select statement is kept at the top)

        const expression = Walker.walkMutate(this, (exp, depth) => {
            if (exp instanceof SelectExpression) {
                for (const field of exp.fieldsArray) {
                    Walker.walk(field, (exp) => {
                        if (exp instanceof FieldIdentifier) {
                            implicitJoins.push(...exp.implicitJoins);
                        }
                    });
                }

                if (depth > 0) {
                    return exp.applyFieldJoins();
                }
                return exp;                
            }
            return exp;
        }) as SelectExpression;


        if (implicitJoins.length === 0) {
            return this;
        }

        const adjusted = processChain(expression) as SelectExpression;
        return adjusted;

        function processChain(source: SourceExpression) {
            const existingJoins = Walker.collectBranch(source,
                (exp) => exp instanceof JoinExpression
            ) as JoinExpression[];

            // Get all joins that need to be applied to this tree
            const joins = implicitJoins.filter(
                (join) => Walker.source(join).entity.name === Walker.source(source).entity.name,
            );

            const filtered = joins.filter(
                (join) => existingJoins.every(
                    (existing) => existing.isEqual(join, `source`) === false
                )
            );

            for (const join of joins) {
                const index = implicitJoins.indexOf(join);
                implicitJoins.splice(index, 1);
            }

            return Walker.walkBranchMutate(source, (exp): SourceExpression => {
                if (exp instanceof JoinExpression) {
                    return new JoinExpression(
                        exp.source,
                        processChain(exp.joined),
                        exp.join,
                    );
                }

                if (exp instanceof FromExpression === false) {
                    return exp;
                }
                
                let current = exp as SourceExpression;
                for (const join of filtered) {
                    current = new JoinExpression(
                        current,
                        join.joined,
                        join.join,
                    );
                }
                return current;
            });
        }

        function implicitJoinExists(join: JoinExpression[], implicit: JoinExpression) {
            return join.some((join) => implicitJoinMatches(join, implicit));
        }

        function implicitJoinMatches(join: JoinExpression, implicit: JoinExpression) {
            if (join.source.isEqual(implicit.source) === false) {
                return false;
            }

            if (join.joined.isEqual(implicit.joined) === false) {
                return false;
            }

            if (join.join.length !== implicit.join.length) {
                return false;
            }

            const joins = implicit.join.slice();
            for (const jn of join.join) {
                const index = joins.findIndex(
                    (j) => jn.isEqual(j)
                );

                if (index === -1) {
                    return false;
                }

                joins.splice(index, 1);
            }

            return true;
        }
    }
}
