const sendMagicLinkEmail = async ({ to, link }) => {
  console.log('[EMAIL:MAGIC]', {
    to,
    link,
    ts: new Date().toISOString()
  });

  return { ok: true };
};

module.exports = {
  sendMagicLinkEmail
};
