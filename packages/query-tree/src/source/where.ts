import { Type } from '../type';
import { BinaryExpression, LogicalExpression } from '../binary';
import { SourceExpression } from './source';

export class WhereExpression extends SourceExpression<`WhereExpression`> {
    expressionType = `WhereExpression` as const;

    get source() {
        return super.source!;
    }

    get fields() {
        return this.source.fields;
    }

    get type(): Type {
        return this.source.type;
    }

    clause: LogicalExpression | BinaryExpression;

    constructor(
        source: SourceExpression,
        clause: LogicalExpression | BinaryExpression,
    ) {
        super(source);
        this.clause = clause;
    }
}
