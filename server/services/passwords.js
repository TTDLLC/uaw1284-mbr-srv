const bcrypt = require('bcryptjs');

const config = require('../config');

const SYMBOL_REGEX = /[^A-Za-z0-9]/;

function validatePasswordStrength(password) {
  const policy = config.security.passwordPolicy;
  const errors = [];

  if (typeof password !== 'string') {
    errors.push('Password must be a string value.');
    return { ok: false, errors };
  }

  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long.`);
  }

  if (password.length > policy.maxLength) {
    errors.push(`Password must be fewer than ${policy.maxLength} characters.`);
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must include at least one lowercase letter.');
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must include at least one uppercase letter.');
  }

  if (policy.requireDigits && !/[0-9]/.test(password)) {
    errors.push('Password must include at least one number.');
  }

  if (policy.requireSymbols && !SYMBOL_REGEX.test(password)) {
    errors.push('Password must include at least one symbol.');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function assertPasswordPolicy(password) {
  const result = validatePasswordStrength(password);
  if (!result.ok) {
    const err = new Error('Password does not meet complexity requirements.');
    err.status = 400;
    err.details = result.errors;
    throw err;
  }
}

function hashPassword(password) {
  assertPasswordPolicy(password);
  return bcrypt.hash(password, config.security.bcryptCost);
}

function verifyPassword(password, hash) {
  if (!hash) {
    return Promise.resolve(false);
  }
  return bcrypt.compare(password, hash);
}

module.exports = {
  assertPasswordPolicy,
  hashPassword,
  validatePasswordStrength,
  verifyPassword
};
