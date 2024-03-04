/* eslint-env node */
module.exports = {
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    ignorePatterns: ["dist/"],
    root: true,
    rules: {
        '@typescript-eslint/no-unused-vars': [`error`, { args: `none` }],
        '@typescript-eslint/no-this-alias': `off`,
    },
    overrides: [{
        files: `*.test.ts`,
        rules: {
            '@typescript-eslint/no-explicit-any': `off`,
            '@typescript-eslint/ban-types': `off`,
        }
    }]
};
