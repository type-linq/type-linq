import { Expression } from './expression.js';
import { Type, UnknownType, isEqual } from './type.js';

export class CallArguments extends Expression {
    arguments: Expression[];
    type: UnknownType = new UnknownType();

    constructor(args: Expression[]) {
        super();
        this.arguments = args;
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression instanceof CallArguments === false) {
            return false;
        }

        return this.arguments.every(
            (arg, idx) => arg.isEqual(expression.arguments[idx])
        );
    }

    *walk() {
        for (const arg of this.arguments) {
            yield arg;
        }
    }

    protected rebuild(...args: Expression[]): Expression {
        return new CallArguments(args);
    }
}

export class CallExpression extends Expression {
    callee: Expression;
    arguments: CallArguments;
    type: Type;
    

    constructor(type: Type, callee: Expression, args: CallArguments = new CallArguments([])) {
        super();
        this.type = type;
        this.callee = callee;
        this.arguments = args;
    }

    isEqual(expression?: Expression): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof CallExpression === false) {
            return false;
        }

        return this.callee.isEqual(expression.callee) &&
            isEqual(this.type, expression.type) &&
            this.arguments.isEqual(expression.arguments);
    }

    rebuild(callee: Expression | undefined, args: CallArguments | undefined): Expression {
        return new CallExpression(
            this.type,
            callee ?? this.callee,
            args ?? this.arguments,
        );
    }

    *walk() {
        yield this.callee;
        yield this.arguments;
    }
}
