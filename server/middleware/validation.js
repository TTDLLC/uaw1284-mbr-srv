const { ZodError } = require('zod');

function validationErrorResponse(err, req, res, next) {
  if (!(err instanceof ZodError)) {
    return next(err);
  }

  const details = err.errors.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message
  }));

  return res.status(400).json({
    ok: false,
    message: 'Request validation failed.',
    errors: details,
    requestId: req.id
  });
}

const validateBody = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse(req.body);
    req.validatedBody = parsed;
    req.body = parsed;
    return next();
  } catch (err) {
    return validationErrorResponse(err, req, res, next);
  }
};

module.exports = {
  validateBody
};
