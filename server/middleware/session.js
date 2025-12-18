function regenerateSessionId(req) {
  if (!req?.session || typeof req.session.regenerate !== 'function') {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        return reject(err);
      }
      return resolve();
    });
  });
}

function assertSessionCookieSecurity(cookieOptions = {}, { isProd }) {
  if (!isProd) {
    return;
  }

  if (!cookieOptions.secure) {
    throw new Error('Session cookies must be marked as secure when running in production.');
  }

  if (!cookieOptions.httpOnly) {
    throw new Error('Session cookies must be httpOnly in production.');
  }

  const sameSite = cookieOptions.sameSite;
  if (sameSite !== 'lax' && sameSite !== 'strict') {
    throw new Error('Session cookies must use sameSite \"lax\" or \"strict\" in production.');
  }
}

module.exports = {
  assertSessionCookieSecurity,
  regenerateSessionId
};
