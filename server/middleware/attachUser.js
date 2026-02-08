const models = require('../models');

const destroySession = (req) => new Promise((resolve) => {
  if (!req?.session || typeof req.session.destroy !== 'function') {
    return resolve();
  }
  req.session.destroy(() => resolve());
});

const isUserInactive = (user) => {
  if (!user) {
    return true;
  }
  if (user.isActive === false) {
    return true;
  }
  if (user.status && user.status !== 'active') {
    return true;
  }
  return false;
};

async function attachUser(req, res, next) {
  try {
    const sessionUser = req.session?.user;
    const userId = sessionUser?.id || req.session?.userId;
    if (!userId) {
      return next();
    }

    const user = await models.User.findById(userId);
    if (!user || isUserInactive(user)) {
      if (req.session) {
        req.session.user = null;
        req.session.userId = null;
      }
      await destroySession(req);
      return next();
    }

    let member = null;
    if (user.memberId) {
      member = await models.Member.findById(user.memberId);
    }

    req.user = user;
    req.member = member;
    res.locals.user = user;
    res.locals.member = member;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = attachUser;
