export function setEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    unsetEnvValue(key);
    return;
  }
  Reflect.set(process.env, key, value);
}

export function unsetEnvValue(key: string) {
  Reflect.deleteProperty(process.env, key);
}
