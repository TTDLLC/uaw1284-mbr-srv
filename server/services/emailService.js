const config = require('../config');

let postmarkClient = null;

const getPostmarkClient = () => {
  if (!postmarkClient) {
    const postmark = require('postmark');
    postmarkClient = new postmark.ServerClient(config.providers.email.postmarkToken);
  }
  return postmarkClient;
};

const sendMagicLinkEmail = async ({ to, link }) => {
  if (config.providers.email.provider === 'postmark') {
    const client = getPostmarkClient();
    await client.sendEmail({
      From: config.providers.email.from,
      To: to,
      Subject: 'Your UAW Local 1284 magic link',
      HtmlBody: `<p>Use this link to sign in:</p><p><a href="${link}">${link}</a></p>`,
      TextBody: `Use this link to sign in: ${link}`
    });
    return { ok: true, provider: 'postmark' };
  }

  console.log('[EMAIL:MAGIC]', {
    to,
    link,
    ts: new Date().toISOString()
  });

  return { ok: true, provider: 'console' };
};

const sendBroadcastEmail = async ({ to, subject, body, notificationId, memberId }) => {
  if (config.providers.email.provider === 'postmark') {
    const client = getPostmarkClient();
    await client.sendEmail({
      From: config.providers.email.from,
      To: to,
      Subject: subject,
      HtmlBody: body,
      TextBody: body.replace(/<[^>]*>/g, '')
    });
    return { ok: true, provider: 'postmark' };
  }

  console.log('[EMAIL:BCAST]', {
    to,
    subject,
    notificationId,
    memberId,
    ts: new Date().toISOString()
  });

  return { ok: true, provider: 'console' };
};

module.exports = {
  sendBroadcastEmail,
  sendMagicLinkEmail
};
