import { Expression } from '../../type.js';
import { ensureIdentifierParams } from './identifier-params.js';

export function bindVars(expression: Expression<`ArrowFunctionExpression`>, count: number, args: unknown) {
    if (args !== null && typeof args === `object` && expression.params.length <= count) {
        // If we have args, but no parameter for them, use a spread operator so we
        //  can access the vars directly in the function
        expression.params[count] = {
            type: `ObjectPattern`,
            properties: Object.keys(args).map((name) => ({
                type: `Property`,
                key: { type: `Identifier`, name },
                computed: false,
                kind: `init`,
                method: false,
                shorthand: true,
                value: { type: `Identifier`, name },
            }))
        };
    }

    // First normalize the expressions
    ensureIdentifierParams(expression);

    // TODO: This feels wrong... surely we want to make sure the vars param is there?

    if (expression.params.length <= count) {
        // No vars param (which should have been added during normalization
        //  unless there were no args supplied) which means nothing to do.
        return;
    }

    // Remove the vars param... TODO: Why... we need it!
    expression.params.length = count;
}
