#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const config = require('../server/config');
const logger = require('../server/logger');
require('../server/models');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'server', 'migrations');

async function loadMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.js'))
    .sort()
    .map((file) => {
      const mod = require(path.join(MIGRATIONS_DIR, file));
      if (!mod?.id || typeof mod.up !== 'function') {
        throw new Error(`Migration ${file} must export { id, up }`);
      }
      return { ...mod, file };
    });
}

async function run() {
  await mongoose.connect(config.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const migrationCollection = mongoose.connection.collection('migrations');
  await migrationCollection.createIndex({ id: 1 }, { unique: true });

  const completed = await migrationCollection.find({}, { projection: { id: 1 } }).toArray();
  const completedIds = new Set(completed.map((doc) => doc.id));

  const migrations = await loadMigrations();
  logger.info({ count: migrations.length }, 'Loaded migrations');

  for (const migration of migrations) {
    if (completedIds.has(migration.id)) {
      logger.info({ id: migration.id }, 'Skipping already applied migration');
      continue;
    }

    logger.info({ id: migration.id, file: migration.file }, 'Running migration');
    try {
      await migration.up({ mongoose, config, logger });
      await migrationCollection.insertOne({
        id: migration.id,
        description: migration.description || null,
        file: migration.file,
        appliedAt: new Date()
      });
      logger.info({ id: migration.id }, 'Migration completed');
    } catch (err) {
      logger.error({ err, id: migration.id }, 'Migration failed');
      throw err;
    }
  }

  await mongoose.disconnect();
}

run().then(() => {
  logger.info('All migrations complete');
  process.exit(0);
}).catch((err) => {
  logger.error({ err }, 'Migration runner failed');
  process.exit(1);
});
