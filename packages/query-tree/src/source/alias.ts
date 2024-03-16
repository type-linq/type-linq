import { SourceExpression } from '../source/source';

export class AliasSource extends SourceExpression<`AliasSource`> {
    expressionType = `AliasSource` as const;
    alias: string;

    get source() {
        return super.source!;
    }

    get fields() {
        return this.source.fields;
    }

    constructor(source: SourceExpression, alias: string) {
        super(source);
        this.alias = alias;
    }
}
