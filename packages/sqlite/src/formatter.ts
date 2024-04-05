const ALL_WHITESPACE = /^([ \t]*)$/;
const TRAILING_WHITESPACE = /\n+([ \t]*)$/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatter(strings: TemplateStringsArray, ...inserts: string[]) {
    // Every time we do a replacement, we check for preceding whitespace, and reproduce it on every line
    const result: string[] = [];
    for (let index = 0; index < strings.length; index++) {
        const string = strings[index];
        if (index === strings.length - 1) {
            result.push(string);
            break;
        }

        // If the first string is all whitespace, we can apply that to the replacements
        const whitespace = index === 0 ?
            string.match(ALL_WHITESPACE) ?? string.match(TRAILING_WHITESPACE) :
            string.match(TRAILING_WHITESPACE);

        if (whitespace === null) {
            result.push(string);
            result.push(inserts[index]);
            continue;
        }

        result.push(string.substring(0, string.length - whitespace[1].length));

        const lines = inserts[index].split(`\n`).map(
            (line) => `${whitespace[1]}${line}`
        );
        result.push(lines.join(`\n`))
    }

    return result.join(``);
}
