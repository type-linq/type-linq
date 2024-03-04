import objectHash from 'object-hash';
import { SOURCE } from '../../../core/src/constant';
import { Expression, ExpressionTypeKey, Operator, Serializable } from '../../../core/src/type';

export type SqlFragment = {
    sql: string;
    variables: Serializable[];
}

export function encodeIdentifier(identifier: string) {
    return `[${identifier.replace(/\[/g, `[[`)}]`;
}

export function compile(expression: Expression<ExpressionTypeKey>, source: string, globals: Map<string, string>): SqlFragment {
    switch (expression.type) {
        case `BinaryExpression`:
        case `LogicalExpression`:
        case `AssignmentExpression`:
            return processLeftRightExpression(expression);
        case `MemberExpression`:
            return processMemberExpression(expression);
        case `Identifier`:
            return processIdentifier(expression);
        case `Literal`:
            return { sql: encodePrimitive(expression.value), variables: [] };
        case `CallExpression`:
            return processCall(expression);
        case `ExternalExpression`:
            if (expression.expression.type !== `Literal`) {
                throw new Error(`Expected external expression to be a literal value`);
            }
            return { sql: `?`, variables: [expression.expression.value] };
        case `UnaryExpression`:
            return processUnary(expression);
        case `ConditionalExpression`:
            return processConditional(expression);
        case `ObjectExpression`:
            return processObject(expression);
        case `ArrowFunctionExpression`:
        case `ArrayPattern`:
        case `ArrayExpression`:
        case `AssignmentPattern`:
        case `AwaitExpression`:
        case `BlockStatement`:
        case `BreakStatement`:
        case `CatchClause`:
        case `ChainExpression`:
        case `ClassBody`:
        case `ClassDeclaration`:
        case `ClassExpression`:
        case `ContinueStatement`:
        case `DebuggerStatement`:
        case `DoWhileStatement`:
        case `EmptyStatement`:
        case `ExperimentalRestProperty`:
        case `ExperimentalSpreadProperty`:
        case `ExportAllDeclaration`:
        case `ExportDefaultDeclaration`:
        case `ExportNamedDeclaration`:
        case `ExportSpecifier`:
        case `ExpressionStatement`:
        case `ForInStatement`:
        case `ForOfStatement`:
        case `ForStatement`:
        case `FunctionDeclaration`:
        case `FunctionExpression`:
        case `IfStatement`:
        case `ImportDeclaration`:
        case `ImportDefaultSpecifier`:
        case `ImportExpression`:
        case `ImportNamespaceSpecifier`:
        case `ImportSpecifier`:
        case `LabeledStatement`:
        case `MetaProperty`:
        case `MethodDefinition`:
        case `NewExpression`:
        case `ObjectPattern`:
        case `PrivateIdentifier`:
        case `Program`:
        case `Property`:
        case `PropertyDefinition`:
        case `RestElement`:
        case `ReturnStatement`:
        case `SequenceExpression`:
        case `SpreadElement`:
        case `StaticBlock`:
        case `Super`:
        case `SwitchCase`:
        case `SwitchStatement`:
        case `TaggedTemplateExpression`:
        case `TemplateElement`:
        case `TemplateLiteral`:
        case `ThisExpression`:
        case `ThrowStatement`:
        case `TryStatement`:
        case `UpdateExpression`:
        case `VariableDeclaration`:
        case `VariableDeclarator`:
        case `WhileStatement`:
        case `WithStatement`:
        case `YieldExpression`:
            throw new Error(`"${expression.type}" not supported in SQLite`);
    }

    function processIdentifier(expression: Expression<`Identifier`>) {
        if (typeof expression.name === `symbol`) {
            switch (expression.name) {
                case SOURCE:
                    return { sql: encodeIdentifier(source), variables: [] };
                default:
                    throw new Error(`Unknown symbol "${String(expression.name)}" received`);
            }
        }

        const global = globals.get(objectHash([expression.name]));
        if (global !== undefined) {
            return { sql: global, variables: [] };
        }

        if (expression.name === `undefined`) {
            return { sql: `NULL`, variables: [] };
        }

        return { sql: encodeIdentifier(expression.name), variables: [] };
    }

    function processMemberExpression(expression: Expression<`MemberExpression`>) {
        if (expression.property.type !== `Identifier` && expression.property.type !== `Literal`) {
            throw new Error(`Expected MemberExpression property to be an Identifier or a Literal`);
        }

        const global = globalValue(expression);
        if (global !== undefined) {
            return { sql: global, variables: [] };
        }

        const { sql: object, variables: objectVariables } = compile(expression.object, source, globals);
        const { sql: prop, variables: propVariables } = compile(expression.property, source, globals);

        const sql = `${object}.${prop}`;
        return { sql, variables: [...objectVariables, ...propVariables] };

        function globalValue(expression: Expression<`MemberExpression` | `Identifier`>) {
            const path = expressionPath(expression);
            const global = globals.get(objectHash(path));
            return global;
        }

        function expressionPath(expression: Expression<`MemberExpression` | `Identifier`>) {
            if (expression.type === `MemberExpression`) {
                return handleMemberExpression(expression);
            } else {
                return [expression.name as string];
            }

            function handleMemberExpression(expression: Expression<`MemberExpression`>): string[] {
                if (expression.property.type !== `Identifier` && expression.property.type !== `Literal`) {
                    throw new Error(`Expected MemberExpression property to be an Identifier or a Literal`);
                }

                const name = expression.property.type === `Identifier` ?
                    expression.property.name as string :
                    String(expression.property.value);

                return [
                    ...expressionPath(expression.object as Expression<`MemberExpression` | `Identifier`>),
                    name,
                ];
            }
        }
    }

    function processCall(expression: Expression<`CallExpression`>): SqlFragment {
        // TODO: The only calls we can have should map back to globals
        throw new Error(`not implemented`);
    }

    function processConditional(expression: Expression<`ConditionalExpression`>) {
        const test = compile(expression.test, source, globals);
        const consequent = compile(expression.consequent, source, globals);
        const alternate = compile(expression.alternate, source, globals);

        return {
            sql: `CASE ${test.sql} WHEN 1 THEN ${consequent.sql} ELSE ${alternate.sql} END`,
            variables: [
                ...test.variables,
                ...consequent.variables,
                ...alternate.variables,
            ]
        };
    }

    function processUnary(expression: Expression<`UnaryExpression`>) {
        if (expression.operator !== `!`) {
            throw new Error(`Unary operator "${expression.operator}" not supported`);
        }

        const { sql: argument, variables } = compile(expression.argument, source, globals);
        return { sql: `NOT (${argument})`, variables };
    }

    function processLeftRightExpression(expression: Expression<`BinaryExpression` | `LogicalExpression` | `AssignmentExpression`>): SqlFragment {
        const { sql: left, variables: leftVariables } = compile(expression.left, source, globals);
        const { sql: right, variables: rightVariables } = compile(expression.right, source, globals);

        const sql = generateBinarySql(left, expression.operator, right);
        const variables = [...leftVariables, ...rightVariables];

        return {
            sql,
            variables,
        };
    }

    function processObject(expression: Expression<`ObjectExpression`>) {
        const columns = expression.properties.map(
            (property) => {
                if (property.type !== `Property`) {
                    throw new Error(`Expected "Property" in ObjectExpression properties`);
                }
                const { sql, variables } = compile(property.value, source, globals);

                if (property.key.type !== `Identifier` && property.key.type !== `Literal`) {
                    throw new Error(`Expected property key to be Identifier or Literal`);
                }
                
                const propertyName = property.key.type === `Identifier` ?
                    property.key.name as string :
                    String(property.key.value);

                return {
                    sql: `${sql} AS ${encodeIdentifier(propertyName)}`,
                    variables,
                }
            }
        );

        const sql = columns.map((column) => column.sql).join(`, `);
        const variables = columns.map((column) => column.variables).flat();
        return {
            sql,
            variables,
        };
    }

    function generateBinarySql(left: string, operator: Operator, right: string) {
        switch (operator) {
            case `===`:
                return `${left} = ${right}`;
            case `!==`:
                return `${left} != ${right}`;
            case `<`:
                return `${left} < ${right}`;
            case `<=`:
                return `${left} <= ${right}`;
            case `>`:
                return `${left} > ${right}`;
            case `>=`:
                return `${left} >= ${right}`;
            case `|`:
                return `${left} | ${right}`;
            case `||`:
                return `(CASE ${left} WHEN NULL THEN ${right} WHEN '' THEN ${right} WHEN 0 THEN ${right} ELSE ${left} END)`;
            case `||=`:
                return `${left} = (CASE ${left} WHEN NULL THEN ${right} WHEN '' THEN ${right} WHEN 0 THEN ${right} ELSE ${left} END)`;
            case `&`:
                return `${left} & ${right}`;
            case `&&`:
                return `(CASE ${left} WHEN NULL THEN NULL WHEN '' THEN '' WHEN 0 THEN 0 ELSE ${right} END)`;
            case `&&=`:
                return `${left} = (CASE ${left} WHEN NULL THEN NULL WHEN '' THEN '' WHEN 0 THEN 0 ELSE ${right} END)`;
            case `~`:
                return `${left} ~ ${right}`;
            case `^`:
                return `${left} ^ ${right}`;
            case `<<`:
                return `${left} << ${right}`;
            case `<<=`:
                return `${left} = ${left} << ${right}`;
            case `>>`:
                return `${left} >> ${right}`;
            case `>>=`:
                return `${left} = ${left} >> ${right}`;
            case `-`:
                return `${left} - ${right}`;
            case `-=`:
                return `${left} = ${left} - ${right}`;
            case `+`:
                return `${left} + ${right}`;
            case `+=`:
                return `${left} = ${left} + ${right}`;
            case `%`:
                return `${left} % ${right}`;
            case `%=`:
                return `${left} = ${left} % ${right}`;
            case `|=`:
                return `${left} = ${left} | ${right}`;
            case `^=`:
                return `${left} = ${left} ^ ${right}`;
            case `&=`:
                return `${left} = ${left} & ${right}`;
            case `??`:
                return `COALESCE(${left}, ${right})`;
            case `??=`:
                return `${left} = COALESCE(${left}, ${right})`;
            case `*`:
                return `${left} * ${right}`;
            case `*=`:
                return `${left} = ${left} * ${right}`;
            case `/`:
                return `${left} / ${right}`;
            case `/=`:
                return `${left} = ${left} / ${right}`;
            case `!`:
                throw new Error(`Operator "${operator}" may not be used in a Binary or Logical Expression`);
            case `!=`:
            case `==`:
            case `++`:
            case `--`:
            case `**`:
            case `**=`:
            case `>>>`:
            case `>>>=`:
            case `in`:
            default:
                throw new Error(`Operator "${operator}" is not supported`);
        }
    }

    function encodePrimitive(value: string | number | boolean | null | undefined) {
        if (value == null) {
            return `NULL`;
        }

        if (typeof value !== `string`) {
            return String(Number(value));
        }

        return `'${value.replace(/'/g, `''`)}'`;
    }
}

