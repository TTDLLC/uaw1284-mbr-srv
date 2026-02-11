const sendMagicLinkEmail = async ({ to, link }) => {
  console.log('[EMAIL:MAGIC]', {
    to,
    link,
    ts: new Date().toISOString()
  });

  return { ok: true };
};

const sendBroadcastEmail = async ({ to, subject, body, notificationId, memberId }) => {
  console.log('[EMAIL:BCAST]', {
    to,
    subject,
    notificationId,
    memberId,
    ts: new Date().toISOString()
  });

  return { ok: true };
};

module.exports = {
  sendBroadcastEmail,
  sendMagicLinkEmail
};
