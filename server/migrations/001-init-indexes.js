const models = require('../models');

module.exports = {
  id: '001-init-indexes',
  description: 'Ensure core model indexes exist for User, Member, and AuditLog collections.',
  async up({ logger }) {
    logger.info('Syncing User indexes');
    await models.User.syncIndexes();
    logger.info('Syncing Member indexes');
    await models.Member.syncIndexes();
    logger.info('Syncing AuditLog indexes');
    await models.AuditLog.syncIndexes();
  }
};
