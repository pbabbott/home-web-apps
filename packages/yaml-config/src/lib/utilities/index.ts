// https://stackoverflow.com/a/54246501/910678
export const camelToSnakeCase = (str: string) => str.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`).toUpperCase()