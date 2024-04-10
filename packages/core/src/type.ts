// From eslint
export const expressionKeys = {
    ArrayExpression: [
        "elements"
    ],
    ArrayPattern: [
        "elements"
    ],
    ArrowFunctionExpression: [
        "params",
        "body"
    ],
    AssignmentExpression: [
        "left",
        "right"
    ],
    AssignmentPattern: [
        "left",
        "right"
    ],
    AwaitExpression: [
        "argument"
    ],
    BinaryExpression: [
        "left",
        "right"
    ],
    BlockStatement: [
        "body"
    ],
    BreakStatement: [
        "label"
    ],
    CallExpression: [
        "callee",
        "arguments"
    ],
    CatchClause: [
        "param",
        "body"
    ],
    ChainExpression: [
        "expression"
    ],
    ClassBody: [
        "body"
    ],
    ClassDeclaration: [
        "id",
        "superClass",
        "body"
    ],
    ClassExpression: [
        "id",
        "superClass",
        "body"
    ],
    ConditionalExpression: [
        "test",
        "consequent",
        "alternate"
    ],
    ContinueStatement: [
        "label"
    ],
    DebuggerStatement: [],
    DoWhileStatement: [
        "body",
        "test"
    ],
    EmptyStatement: [],
    ExperimentalRestProperty: [
        "argument"
    ],
    ExperimentalSpreadProperty: [
        "argument"
    ],
    ExportAllDeclaration: [
        "exported",
        "source"
    ],
    ExportDefaultDeclaration: [
        "declaration"
    ],
    ExportNamedDeclaration: [
        "declaration",
        "specifiers",
        "source"
    ],
    ExportSpecifier: [
        "exported",
        "local"
    ],
    ExpressionStatement: [
        "expression"
    ],
    ForInStatement: [
        "left",
        "right",
        "body"
    ],
    ForOfStatement: [
        "left",
        "right",
        "body"
    ],
    ForStatement: [
        "init",
        "test",
        "update",
        "body"
    ],
    FunctionDeclaration: [
        "id",
        "params",
        "body"
    ],
    FunctionExpression: [
        "id",
        "params",
        "body"
    ],
    Identifier: [],
    IfStatement: [
        "test",
        "consequent",
        "alternate"
    ],
    ImportDeclaration: [
        "specifiers",
        "source"
    ],
    ImportDefaultSpecifier: [
        "local"
    ],
    ImportExpression: [
        "source"
    ],
    ImportNamespaceSpecifier: [
        "local"
    ],
    ImportSpecifier: [
        "imported",
        "local"
    ],
    JSXAttribute: [
        "name",
        "value"
    ],
    JSXClosingElement: [
        "name"
    ],
    JSXClosingFragment: [],
    JSXElement: [
        "openingElement",
        "children",
        "closingElement"
    ],
    JSXEmptyExpression: [],
    JSXExpressionContainer: [
        "expression"
    ],
    JSXFragment: [
        "openingFragment",
        "children",
        "closingFragment"
    ],
    JSXIdentifier: [],
    JSXMemberExpression: [
        "object",
        "property"
    ],
    JSXNamespacedName: [
        "namespace",
        "name"
    ],
    JSXOpeningElement: [
        "name",
        "attributes"
    ],
    JSXOpeningFragment: [],
    JSXSpreadAttribute: [
        "argument"
    ],
    JSXSpreadChild: [
        "expression"
    ],
    JSXText: [],
    LabeledStatement: [
        "label",
        "body"
    ],
    Literal: [],
    LogicalExpression: [
        "left",
        "right"
    ],
    MemberExpression: [
        "object",
        "property"
    ],
    MetaProperty: [
        "meta",
        "property"
    ],
    MethodDefinition: [
        "key",
        "value"
    ],
    NewExpression: [
        "callee",
        "arguments"
    ],
    ObjectExpression: [
        "properties"
    ],
    ObjectPattern: [
        "properties"
    ],
    PrivateIdentifier: [],
    Program: [
        "body"
    ],
    Property: [
        "key",
        "value"
    ],
    PropertyDefinition: [
        "key",
        "value"
    ],
    RestElement: [
        "argument"
    ],
    ReturnStatement: [
        "argument"
    ],
    SequenceExpression: [
        "expressions"
    ],
    SpreadElement: [
        "argument"
    ],
    StaticBlock: [
        "body"
    ],
    Super: [],
    SwitchCase: [
        "test",
        "consequent"
    ],
    SwitchStatement: [
        "discriminant",
        "cases"
    ],
    TaggedTemplateExpression: [
        "tag",
        "quasi"
    ],
    TemplateElement: [],
    TemplateLiteral: [
        "quasis",
        "expressions"
    ],
    ThisExpression: [],
    ThrowStatement: [
        "argument"
    ],
    TryStatement: [
        "block",
        "handler",
        "finalizer"
    ],
    UnaryExpression: [
        "argument"
    ],
    UpdateExpression: [
        "argument"
    ],
    VariableDeclaration: [
        "declarations"
    ],
    VariableDeclarator: [
        "id",
        "init"
    ],
    WhileStatement: [
        "test",
        "body"
    ],
    WithStatement: [
        "object",
        "body"
    ],
    YieldExpression: [
        "argument"
    ],

    // Custom for variables
    ExternalExpression: [
        "expression"
    ]
} as const;

export enum ExpressionType {
    ArrayExpression = `ArrayExpression`,
    ArrayPattern = `ArrayPattern`,
    ArrowFunctionExpression = `ArrowFunctionExpression`,
    AssignmentExpression = `AssignmentExpression`,
    AssignmentPattern = `AssignmentPattern`,
    AwaitExpression = `AwaitExpression`,
    BinaryExpression = `BinaryExpression`,
    BlockStatement = `BlockStatement`,
    BreakStatement = `BreakStatement`,
    CallExpression = `CallExpression`,
    CatchClause = `CatchClause`,
    ChainExpression = `ChainExpression`,
    ClassBody = `ClassBody`,
    ClassDeclaration = `ClassDeclaration`,
    ClassExpression = `ClassExpression`,
    ConditionalExpression = `ConditionalExpression`,
    ContinueStatement = `ContinueStatement`,
    DebuggerStatement = `DebuggerStatement`,
    DoWhileStatement = `DoWhileStatement`,
    EmptyStatement = `EmptyStatement`,
    ExperimentalRestProperty = `ExperimentalRestProperty`,
    ExperimentalSpreadProperty = `ExperimentalSpreadProperty`,
    ExportAllDeclaration = `ExportAllDeclaration`,
    ExportDefaultDeclaration = `ExportDefaultDeclaration`,
    ExportNamedDeclaration = `ExportNamedDeclaration`,
    ExportSpecifier = `ExportSpecifier`,
    ExpressionStatement = `ExpressionStatement`,
    ForInStatement = `ForInStatement`,
    ForOfStatement = `ForOfStatement`,
    ForStatement = `ForStatement`,
    FunctionDeclaration = `FunctionDeclaration`,
    FunctionExpression = `FunctionExpression`,
    Identifier = `Identifier`,
    IfStatement = `IfStatement`,
    ImportDeclaration = `ImportDeclaration`,
    ImportDefaultSpecifier = `ImportDefaultSpecifier`,
    ImportExpression = `ImportExpression`,
    ImportNamespaceSpecifier = `ImportNamespaceSpecifier`,
    ImportSpecifier = `ImportSpecifier`,
    LabeledStatement = `LabeledStatement`,
    Literal = `Literal`,
    LogicalExpression = `LogicalExpression`,
    MemberExpression = `MemberExpression`,
    MetaProperty = `MetaProperty`,
    MethodDefinition = `MethodDefinition`,
    NewExpression = `NewExpression`,
    ObjectExpression = `ObjectExpression`,
    ObjectPattern = `ObjectPattern`,
    PrivateIdentifier = `PrivateIdentifier`,
    Program = `Program`,
    Property = `Property`,
    PropertyDefinition = `PropertyDefinition`,
    RestElement = `RestElement`,
    ReturnStatement = `ReturnStatement`,
    SequenceExpression = `SequenceExpression`,
    SpreadElement = `SpreadElement`,
    StaticBlock = `StaticBlock`,
    Super = `Super`,
    SwitchCase = `SwitchCase`,
    SwitchStatement = `SwitchStatement`,
    TaggedTemplateExpression = `TaggedTemplateExpression`,
    TemplateElement = `TemplateElement`,
    TemplateLiteral = `TemplateLiteral`,
    ThisExpression = `ThisExpression`,
    ThrowStatement = `ThrowStatement`,
    TryStatement = `TryStatement`,
    UnaryExpression = `UnaryExpression`,
    UpdateExpression = `UpdateExpression`,
    VariableDeclaration = `VariableDeclaration`,
    VariableDeclarator = `VariableDeclarator`,
    WhileStatement = `WhileStatement`,
    WithStatement = `WithStatement`,
    YieldExpression = `YieldExpression`,
    ExternalExpression = `ExternalExpression`,
}

type Keys = typeof expressionKeys;

export type ExpressionTypeKey = `${ExpressionType}`;

type IdentifierType = `Identifier` | `${string}Identifier`;
type ArrayType =
    `arguments` |
    `elements` |
    `params` |
    `specifiers` |
    `properties` |
    `expressions` |
    `declarations` |
    `quasis`;

type Literal = {
    type: `Literal`;
    value: string | number | boolean;
    raw: string | number | boolean;
};

type ExpressionBase<TType extends ExpressionTypeKey> =
    { type: TType; } &
    {
        [KKey in Keys[TType][number]]: KKey extends ArrayType
            ? Expression<ExpressionTypeKey>[]
            : Expression<ExpressionTypeKey>;
    }

export type Operator = `===` | `==` | `!=` | `!==` | `<` | `<=` | `>` | `>=` | `!`
    | `+` | `++` | `+=`
    | `-` | `--` | `-=`
    | `*` | `*=`
    | `/` | `/=`
    | `**` | `**=`
    | `|` | `|=`
    | `||` | `||=`
    | `~`
    | `^` | `^=`
    | `&` | `&=`
    | `&&` | `&&=`
    | `??` | `??=`
    | `%` | `%=`
    | `<<` | `<<=`
    | `>>` | `>>=`
    | `>>>` | `>>>=`
    | `in`;

export type Expression<TType extends ExpressionTypeKey> =
    TType extends IdentifierType
    ? { type: TType, name: string | symbol }
    : TType extends `Literal`
    ? Literal
    : TType extends `Program`
    ? ExpressionBase<`Program`> & { body: Expression<ExpressionTypeKey>[] }
    : TType extends `BlockStatement`
    ? ExpressionBase<`BlockStatement`> & { body: Expression<ExpressionTypeKey>[] }
    : TType extends `BinaryExpression` | `LogicalExpression` | `UnaryExpression` | `AssignmentExpression`
    ? ExpressionBase<TType> & { operator: Operator }
    : TType extends `Property`
    ? ExpressionBase<`Property`> & { computed: boolean, kind: `init`, method: boolean, shorthand: boolean }
    : TType extends `TemplateElement`
    ? ExpressionBase<`TemplateElement`> & { tail: boolean, value: { raw: string, cooked: string } }
    : ExpressionBase<TType>;

type Primitive = number | bigint | string | boolean | undefined;

export type Serializable = Primitive | {
    [name: string | number]: Serializable | Serializable[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunc = (args: any) => any;

export type Func<TResult, TArgs extends unknown[] = unknown[]> = (...args: TArgs) => TResult;
