export enum ExpressionType {
    Program = `Program`,
    Identifier = `Identifier`,
    Literal = `Literal`,
    MemberExpression = `MemberExpression`,
    CallExpression = `CallExpression`,
    Column = `Column`,
    ResultColumn = `ResultColumn`,
    SelectExpression = `SelectExpression`,
    WhereExpression = `WhereExpression`,
    JoinExpression = `JoinExpression`,
    TableReference = `TableReference`,
    OrderingTerm = `OrderingTerm`,
    JoinConstraint = `JoinConstraint`,
}

export interface Expression {
    type: ExpressionType;
}

export interface TableReference extends Expression {
    type: ExpressionType.TableReference;
    schema?: string;
    name: string;
    alias?: string;
    expression?: Expression;
}

export interface ResultColumn extends Expression {
    type: ExpressionType.ResultColumn;
    expression?: Expression;
    tableName?: string;
    alias?: string;
}

export interface OrderingTerm extends Expression {
    type: ExpressionType.OrderingTerm;
    expression: Expression;
    collation?: string;
    asc?: boolean;
    nulls?: `first` | `last`;
}

export interface JoinOperator<
    TCross extends boolean | undefined = undefined,

    TOuter extends TCross extends true
        ? never | false | undefined
        : boolean | undefined = undefined,

    TInner extends TCross extends true
        ? never | false | undefined
        : TOuter extends true
        ? never | false | undefined
        : boolean | undefined = undefined,

    TNatural extends TCross extends true
        ? never | false | undefined
        : boolean | undefined = undefined,

    
> extends Expression {
    type: ExpressionType.JoinExpression;
    cross?: TCross;
    natural?: TNatural;
    outer?: TOuter;
    inner?: TInner;
    joinType?: TInner extends true ? never : `left` | `right` | `full`,
}

export interface JoinConstraint<TUsing extends string[] | undefined> {
    type: ExpressionType.JoinConstraint;
    expression: TUsing extends string[] ?
        never :
        Expression;
    using?: string[];
}














export interface Identifier extends Expression {
    type: ExpressionType.Identifier,
    schema?: string;
    table?: string;
    name: string;
}

export interface Literal extends Expression {
    type: ExpressionType.Literal;
    value: string | number | boolean;
}

export interface CallExpression extends Expression {
    callee: Identifier;
    arguments: (Identifier | Literal | CallExpression)[];
}

export interface Column extends Expression {
    type: ExpressionType.Column;
    source: Identifier | JoinExpression;
    alias?: string;
}



export interface JoinExpression {
    operator?: JoinOperator;
    // source: 
}



export type SelectExpression = {
    distinct: boolean;
    columns: Column[];
    sources: (Identifier | SelectExpression)[];

}
