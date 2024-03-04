export class Enumerable<TElement> {
    [Symbol.asyncIterator](): AsyncIterator<TElement> {
        throw new Error(`not implemented`);
    }

    // TODO: Enumerable should have iterator as well no?
}
