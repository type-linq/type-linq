import { JoinExpression } from './source/join.js';
import { SelectExpression } from './source/select.js';
import { SourceExpression } from './source/source.js';
import { Walker } from './walker.js';

export class Janitor {
    static finalize = finalize;
}

function finalize(source: SourceExpression, forceSelect = true, forceScalars = false): SourceExpression {
    // TODO: We are missing assigning unique names....
    // TODO: We need to add the scalars
    let select: SelectExpression | undefined = undefined;
    const expression = Walker.walkBranchMutate(source, (exp) => {
        if (exp instanceof JoinExpression) {
            return new JoinExpression(
                exp.source,
                finalize(exp.joined, false, false),
                exp.join,
            );
        }

        if (exp instanceof SelectExpression) {
            select = exp;
            return select.source;
        }

        return exp;
    });

    if (expression instanceof SelectExpression === false && forceSelect === false) {
        return expression;
    }

    if (select === undefined && forceSelect) {
        select = new SelectExpression(
            expression,
            expression.fields,
        );
    } else if (select) {
        select = new SelectExpression(
            expression,
            (select as SelectExpression).fields,
        );
    }

    if (select === undefined) {
        return expression;
    }

    const result = select.applyFieldJoins();
    return result;
}