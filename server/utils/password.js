const crypto = require('crypto');

let bcrypt = null;
try {
  // Optional dependency; may not be installed in constrained environments
  // eslint-disable-next-line global-require
  bcrypt = require('bcryptjs');
} catch (err) {
  bcrypt = null;
}

function hashPassword(password) {
  if (bcrypt && typeof bcrypt.hash === 'function') {
    return bcrypt.hash(password, 10);
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return Promise.resolve(`scrypt$${salt}$${derived}`);
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return Promise.resolve(false);
  if (bcrypt && typeof bcrypt.compare === 'function') {
    return bcrypt.compare(password, storedHash);
  }
  if (storedHash.startsWith('scrypt$')) {
    const [, salt, hash] = storedHash.split('$');
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return Promise.resolve(crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(derived)));
  }
  return Promise.resolve(false);
}

module.exports = { hashPassword, verifyPassword };
