const models = require('../models');
const { sendBroadcastEmail } = require('../services/emailService');
const { sendBroadcastSms } = require('../services/smsService');

const BATCH_SIZE = 50;
let isRunning = false;
const pendingQueue = [];

const processRecipient = async (notification, recipient) => {
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
      { $set: { status: 'sent', error: null } }
    );
    await models.Notification.updateOne(
      { _id: notification._id },
      { $inc: { sent: 1 } }
    );
  } catch (err) {
    await models.NotificationRecipient.updateOne(
      { _id: recipient._id },
      { $set: { status: 'failed', error: err?.message || 'Send failed' } }
    );
    await models.Notification.updateOne(
      { _id: notification._id },
      { $inc: { failed: 1 } }
    );
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
      status: 'queued'
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

  await models.Notification.updateOne(
    { _id: notificationId, status: 'sending' },
    { $set: { status: 'completed' } }
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
