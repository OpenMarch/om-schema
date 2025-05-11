/** @type {import('./lib/types').Configuration} */
export default {
    "*.{ts}": "eslint --fix",
    "*.{ts,json,md}": "prettier --write",
    "**/*.ts?(x)": () => "tsc -p tsconfig.json --noEmit --strict",
};
