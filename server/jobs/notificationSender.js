const models = require('../models');
const { sendBroadcastEmail } = require('../services/emailService');
const { sendBroadcastSms } = require('../services/smsService');
const { categorizeProviderError } = require('../utils/providerErrors');

const BATCH_SIZE = 50;
let isRunning = false;
const pendingQueue = [];

const processRecipient = async (notification, recipient) => {
  const nextAttempts = (recipient.attempts || 0) + 1;
  const lastAttemptAt = new Date();
  try {
    if (recipient.channel === 'email') {
      await sendBroadcastEmail({
        to: recipient.destination,
        subject: notification.subject,
        body: notification.body,
        notificationId: notification.id,
        memberId: recipient.memberId.toString()
      });
    } else if (recipient.channel === 'sms') {
      await sendBroadcastSms({
        toE164: recipient.destination,
        body: notification.body,
        notificationId: notification.id,
        memberId: recipient.memberId.toString()
      });
    }

    await models.NotificationRecipient.updateOne(
      { _id: recipient._id },
      { $set: { status: 'sent', error: null, errorCode: null, attempts: nextAttempts, lastAttemptAt } }
    );
    await models.Notification.updateOne(
      { _id: notification._id },
      { $inc: { sent: 1 } }
    );
  } catch (err) {
    const { errorCode, safeMessage } = categorizeProviderError(err);
    const noRetry = errorCode === 'INVALID_DESTINATION' || errorCode === 'PROVIDER_REJECTED';
    const shouldRetry = !noRetry && nextAttempts < 2;
    const nextStatus = shouldRetry ? 'queued' : 'failed';
    await models.NotificationRecipient.updateOne(
      { _id: recipient._id },
      {
        $set: {
          status: nextStatus,
          error: safeMessage,
          errorCode,
          attempts: nextAttempts,
          lastAttemptAt
        }
      }
    );
    if (nextStatus === 'failed') {
      await models.Notification.updateOne(
        { _id: notification._id },
        { $inc: { failed: 1 } }
      );
    }
  }
};

const runNotification = async (notificationId) => {
  await models.Notification.updateOne(
    { _id: notificationId },
    { $set: { status: 'sending' } }
  );

  while (true) {
    const recipients = await models.NotificationRecipient.find({
      notificationId,
      status: 'queued',
      attempts: { $lt: 2 }
    })
      .limit(BATCH_SIZE)
      .lean();

    if (!recipients.length) {
      break;
    }

    const notification = await models.Notification.findById(notificationId);
    if (!notification) {
      break;
    }

    for (const recipient of recipients) {
      // eslint-disable-next-line no-await-in-loop
      await processRecipient(notification, recipient);
    }
  }

  const notification = await models.Notification.findById(notificationId).lean();
  const completionUpdate = { status: 'completed' };
  if (notification?.isAnnouncement && !notification?.publishedAt) {
    completionUpdate.publishedAt = new Date();
  }

  await models.Notification.updateOne(
    { _id: notificationId, status: 'sending' },
    { $set: completionUpdate }
  );
};

const startNext = (notificationId) => {
  isRunning = true;
  setImmediate(async () => {
    try {
      await runNotification(notificationId);
    } catch (err) {
      await models.Notification.updateOne(
        { _id: notificationId },
        { $set: { status: 'failed' } }
      );
    } finally {
      isRunning = false;
      if (pendingQueue.length > 0) {
        const nextId = pendingQueue.shift();
        if (nextId) {
          startNext(nextId);
        }
      }
    }
  });
};

const enqueueNotificationSend = (notificationId) => {
  if (isRunning) {
    const idString = String(notificationId);
    const alreadyQueued = pendingQueue.some((queuedId) => String(queuedId) === idString);
    if (!alreadyQueued) {
      pendingQueue.push(notificationId);
    }
    return;
  }
  startNext(notificationId);
};

module.exports = {
  enqueueNotificationSend
};
