import { Expression, ExpressionType, ExpressionTypeKey } from '../../type.js';
import { mutateWalk } from '../../walk.js';

// TODO: Modify this to not mutate the expression

/** Ensures the vars param is standard identifier, and any references to it are member expressions */
export function ensureIdentifierParams(expression: Expression<`ArrowFunctionExpression`>) {
    for (let index = 0; index < expression.params.length; index++) {
        ensureIdentifierParam(expression, index);
    }
}

/** Ensures the specified param is standard identifier, and any references to it are member expressions */
function ensureIdentifierParam(expression: Expression<`ArrowFunctionExpression`>, index: number) {
    // Nothing to normalize
    if (expression.params.length < index + 1) {
        return;
    }
    const param = expression.params[index];

    // Args is in the form we want, nothing to normalize
    if (param.type === `Identifier`) {
        return;
    }

    // We need a name for the param
    const argName = `arg_${Math.random().toString(36).substring(2)}`;
    const identifier = {
        type: ExpressionType.Identifier,
        name: argName,
    } as Expression<ExpressionType.Identifier>;

    switch (param.type) {
        case `ObjectPattern`:
        case `ArrayPattern`:
            break;
        default:
            // TODO: When we get an AssignmentPattern this will be triggered. Need to figure out default values
            //  (Which probably means we need args in this function? Or perhaps we will just read the default values in another place?)
            throw new Error(`Unable to process "${param.type}" as vars param`);
    }

    const identifiers: Record<string, Expression<ExpressionType.Identifier | ExpressionType.Literal>[]> = {};
    identifierPath(param, [identifier]);

    // TODO: Make these external expressions
    const identifierExpressions: Record<string, Expression<ExpressionType.ExternalExpression>> = Object.fromEntries(
        Object.entries(identifiers).map(([identifier, path]) => {
            return [identifier, externalExpression(path.reverse())]
        })
    );

    // Replace param        
    expression.params[index] = identifier;

    // Replace identifiers with member expressions
    expression.body = mutateWalk(expression.body, (expression) => {
        if (expression.type === `Identifier`) {
            if (expression.name in identifierExpressions) {
                return identifierExpressions[expression.name as string];
            }
        }
        return expression;
    });

    function identifierPath(expression: Expression<ExpressionTypeKey>, path: Expression<ExpressionType.Identifier | ExpressionType.Literal>[]) {
        if (expression.type === ExpressionType.ObjectPattern) {
            for (const prop of expression.properties) {
                if (prop.type !== ExpressionType.Property) {
                    throw new Error(`Recieved unexpected expression type "${prop.type}". Expected "${ExpressionType.Property}"`);
                }

                if (prop.key.type !== `Identifier` && prop.key.type !== `Literal`) {
                    throw new Error(`Unexpected "Property" key type "${prop.key.type}" received`);
                }

                if (prop.value.type === `Identifier`) {
                    identifiers[prop.value.name as string] = [...path, prop.key as Expression<ExpressionType.Identifier | ExpressionType.Literal>];
                } else {
                    identifierPath(prop.value, [...path, prop.key as Expression<ExpressionType.Identifier | ExpressionType.Literal>]);
                }
            }
        } else if (expression.type === ExpressionType.ArrayPattern) {
            for (let index = 0; index < expression.elements.length; index++) {
                const element = expression.elements[index];
                const indexer = { type: ExpressionType.Literal, value: index, raw: index } as Expression<ExpressionType.Literal>;
                if (element.type === `Identifier`) {
                    identifiers[element.name as string] = [...path, indexer];
                } else {
                    identifierPath(element, [...path, indexer]);
                }
            }
        } else {
            throw new Error(`Unexpected expression type "${expression.type} received"`);
        }
    }

    function externalExpression(path: Expression<ExpressionType.Identifier | ExpressionType.Literal>[]): Expression<ExpressionType.ExternalExpression> {
        const memberExpression = {
            type: `MemberExpression`,
            object: path.length > 2 ?
                externalExpression(path.slice(1)) :
                path[1],
            property: path[0],
        } as Expression<ExpressionType.MemberExpression>;

        return {
            type: ExpressionType.ExternalExpression,
            expression: memberExpression,
        } as Expression<ExpressionType.ExternalExpression>;
    }
}
