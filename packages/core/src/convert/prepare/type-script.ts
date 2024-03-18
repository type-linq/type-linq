import { Expression, ExpressionTypeKey } from '../../type.js';

// Typescript
//  Convert shims back to modern js

export function undoTypeScriptTransforms(expression: Expression<ExpressionTypeKey>) {
    expression = undoNullishCoalescingTransform(expression);
    return expression;
}

function undoNullishCoalescingTransform(expression: Expression<ExpressionTypeKey>) {
/*
    const foo = { prop1: `` };
    const bar = { prop2: `` };
    const baz = { prop3: `` };

    // Original
    

    const res1 = () => foo.prop1 ?? bar.prop2;
    const res1 = () => { var _a; return (_a = foo.prop1) !== null && _a !== undefined ? _a : bar.prop2 }

    const res2 = foo.prop1 ?? bar.prop2;
    const res2 = (_a = foo.prop1) !== null && _a !== undefined ? _a : bar.prop2 };

    const res3 = foo.prop1 ?? bar.prop2 ?? baz.prop3;
    const res3 = (_b = (_a = foo.prop1) !== null && _a !== undefined ? _a : bar.prop2) !== null && _b !== void 0 ? _b : baz.prop3 };
*/
    return expression;
}
