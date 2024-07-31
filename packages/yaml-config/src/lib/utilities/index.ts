// https://stackoverflow.com/a/54246501/910678
export const camelToUpperCaseSnakeCase = (str: string) => str.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`).toUpperCase()