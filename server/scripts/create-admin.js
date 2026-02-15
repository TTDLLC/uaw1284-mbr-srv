#!/usr/bin/env node
require('dotenv').config();

const readline = require('readline');
const mongoose = require('mongoose');

const config = require('../config');
const logger = require('../logger');
const models = require('../models');
const { hashPassword, validatePasswordStrength } = require('../services/passwords');
const { logAction } = require('../utils/audit');

const EXIT_VALIDATION = 1;
const EXIT_UNEXPECTED = 2;

class ScriptError extends Error {
  constructor(message, exitCode) {
    super(message);
    this.exitCode = exitCode;
  }
}

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const collapseWhitespace = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const parseName = (value) => {
  const normalized = collapseWhitespace(value);
  if (!normalized) {
    return { firstName: '', lastName: '' };
  }
  const parts = normalized.split(' ');
  const firstName = parts.shift() || '';
  const lastName = parts.join(' ');
  return { firstName, lastName };
};

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }
    const key = arg.slice(2);
    if (key === 'force') {
      args.force = true;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = '';
    }
  }
  return args;
};

const prompt = (rl, question) => new Promise((resolve) => {
  rl.question(question, (answer) => resolve(answer));
});

const getAllowedRoles = () => {
  const rolePath = models.User.schema.path('role');
  return Array.isArray(rolePath?.enumValues) ? rolePath.enumValues : [];
};

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const email = normalizeEmail(args.email || await prompt(rl, 'Email: '));
    if (!email) {
      throw new ScriptError('Email is required.', EXIT_VALIDATION);
    }

    const allowedRoles = getAllowedRoles();

    await mongoose.connect(config.MONGO_URI, { serverSelectionTimeoutMS: 5000 });

    const existingUser = await models.User.findOne({ email });
    const hasActiveAdmin = await models.User.exists({ role: 'admin', status: 'active' });
    const force = Boolean(args.force);

    if (existingUser) {
      if (!force) {
        throw new ScriptError('User already exists. Re-run with --force to update role/password.', EXIT_VALIDATION);
      }

      const updates = [];
      if (args.role) {
        const roleInput = String(args.role).trim();
        if (!allowedRoles.includes(roleInput)) {
          throw new ScriptError(`Role must be one of: ${allowedRoles.join(', ')}`, EXIT_VALIDATION);
        }
        existingUser.role = roleInput;
        updates.push('role');
      }

      if (args.name || args.firstName || args.lastName) {
        const namePayload = (args.firstName || args.lastName)
          ? {
            firstName: String(args.firstName || '').trim(),
            lastName: String(args.lastName || '').trim()
          }
          : parseName(args.name);
        existingUser.firstName = namePayload.firstName;
        existingUser.lastName = namePayload.lastName;
        updates.push('name');
      }

      if (args.password) {
        const newPassword = args.password;
        const passwordCheck = validatePasswordStrength(newPassword);
        if (!passwordCheck.ok) {
          console.error('Password does not meet complexity requirements.');
          passwordCheck.errors.forEach((err) => console.error(`- ${err}`));
          process.exitCode = EXIT_VALIDATION;
          return;
        }
        existingUser.passwordHash = await hashPassword(newPassword);
        existingUser.lastPasswordChangeAt = new Date();
        updates.push('password');
      }

      existingUser.status = 'active';
      if (!updates.includes('status')) {
        updates.push('status');
      }

      await existingUser.save();

      try {
        await logAction({
          actorUserId: existingUser._id,
          action: 'admin.bootstrap.updated',
          targetType: 'user',
          targetId: existingUser._id,
          metadata: { updates, actor: 'system' }
        });
      } catch (err) {
        logger.warn({ err }, 'Failed to write admin bootstrap audit log');
      }

      console.log(`Updated user ${existingUser.email} (${existingUser.id}).`);
      console.log(`Fields updated: ${updates.join(', ')}`);
      return;
    }

    const roleInput = args.role ? String(args.role).trim() : 'admin';
    if (!allowedRoles.includes(roleInput)) {
      throw new ScriptError(`Role must be one of: ${allowedRoles.join(', ')}`, EXIT_VALIDATION);
    }

    if (roleInput === 'admin' && hasActiveAdmin && !force) {
      throw new ScriptError('An active admin already exists. Re-run with --force to create another admin.', EXIT_VALIDATION);
    }

    const namePayload = (args.firstName || args.lastName)
      ? {
        firstName: String(args.firstName || '').trim(),
        lastName: String(args.lastName || '').trim()
      }
      : parseName(args.name || await prompt(rl, 'Full name: '));

    const password = args.password || await prompt(rl, 'Password: ');
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.ok) {
      console.error('Password does not meet complexity requirements.');
      passwordCheck.errors.forEach((err) => console.error(`- ${err}`));
      process.exitCode = EXIT_VALIDATION;
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await models.User.create({
      email,
      firstName: namePayload.firstName,
      lastName: namePayload.lastName,
      role: roleInput,
      status: 'active',
      passwordHash
    });

    try {
      await logAction({
        actorUserId: user._id,
        action: 'admin.bootstrap.created',
        targetType: 'user',
        targetId: user._id,
        metadata: { actor: 'system' }
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to write admin bootstrap audit log');
    }

    console.log(`Created user ${user.email} (${user.id}).`);
  } catch (err) {
    if (err instanceof ScriptError) {
      console.error(err.message);
      process.exitCode = err.exitCode;
    } else {
      console.error('Unexpected error while creating admin user.');
      console.error(err?.message || err);
      process.exitCode = EXIT_UNEXPECTED;
    }
  } finally {
    rl.close();
    await mongoose.disconnect().catch(() => undefined);
  }
}

run();
