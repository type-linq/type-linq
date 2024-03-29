export function randString(length?: number) {
    const result = Math.random().toString(36).substring(2);
    if (length as number > 0) {
        return result.substring(0, length);
    }
    return result;
}
