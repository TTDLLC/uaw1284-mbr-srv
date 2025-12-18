const DEMO_USERS = [
  {
    id: 'demo-admin',
    email: 'admin@local1284.org',
    role: 'admin',
    passwordHash: '$2b$10$U2v6Q0Eb5WSntUeO5UPTH.BcM/3q6h0b62oyMse2AmV9lG.gdCDKu'
  },
  {
    id: 'demo-staff',
    email: 'staff@local1284.org',
    role: 'staff',
    passwordHash: '$2b$10$UTI7d5gFRWKhH/WlSPNgDu7RYrvc7ess6BpaGk2/hn9zuGlQfF49i'
  }
];

async function findByEmail(email) {
  if (!email) {
    return null;
  }
  const normalized = email.trim().toLowerCase();
  return DEMO_USERS.find((user) => user.email.toLowerCase() === normalized) || null;
}

module.exports = {
  findByEmail
};
