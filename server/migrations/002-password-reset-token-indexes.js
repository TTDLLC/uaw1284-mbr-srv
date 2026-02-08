const models = require('../models');

module.exports = {
  id: '002-password-reset-token-indexes',
  description: 'Ensure PasswordResetToken indexes exist and TTL is applied.',
  async up({ logger }) {
    logger.info('Syncing PasswordResetToken indexes');
    await models.PasswordResetToken.syncIndexes();
  }
};
