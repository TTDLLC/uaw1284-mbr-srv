const REQUIRED_ENV_VARS = ['MONGO_URI', 'SESSION_SECRET'];

function hasValue(value) {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return true;
}

function normalizeToArray(values) {
  if (!Array.isArray(values)) {
    return typeof values === 'undefined' ? [] : [values];
  }
  return values;
}

function validateRequiredEnv({
  env = process.env,
  required = REQUIRED_ENV_VARS,
  disallowValues = {},
  enabled = true
} = {}) {
  if (!enabled) {
    return;
  }

  const missing = required.filter((name) => !hasValue(env[name]));
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  const invalidDefaults = Object.entries(disallowValues)
    .filter(([name, values]) => {
      if (!hasValue(env[name])) {
        return false;
      }
      const valueList = normalizeToArray(values);
      return valueList.includes(env[name]);
    })
    .map(([name]) => name);

  if (invalidDefaults.length > 0) {
    throw new Error(
      `Environment variable(s) must not use default placeholder values: ${invalidDefaults.join(', ')}`
    );
  }
}

module.exports = { REQUIRED_ENV_VARS, validateRequiredEnv };
