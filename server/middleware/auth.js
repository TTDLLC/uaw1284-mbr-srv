function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect('/admin/login');
}

function ensureRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/admin/login');
    }
    if (!roles.length || roles.includes(req.session.user.role)) {
      return next();
    }
    return res.status(403).render('500', {
      title: 'Forbidden',
      layout: 'layout',
      msg: 'You do not have permission to access this area.',
      requestId: req.id
    });
  };
}

function ensureSmsPermission(req, res, next) {
  if (req.session?.user?.canSendSms) {
    return next();
  }
  return res.status(403).render('500', {
    title: 'Forbidden',
    layout: 'layout',
    msg: 'SMS permissions required to send messages.',
    requestId: req.id
  });
}

module.exports = { ensureAuthenticated, ensureRole, ensureSmsPermission };
