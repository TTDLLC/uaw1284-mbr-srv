const normalizePhone = (input) => {
  if (!input) {
    return null;
  }
  const raw = String(input).trim();
  if (!raw) {
    return null;
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (raw.startsWith('+') && digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return null;
};

const maskPhone = (e164) => {
  if (!e164) {
    return '';
  }
  const digits = e164.replace(/\D/g, '');
  if (digits.length < 4) {
    return '***';
  }
  const last4 = digits.slice(-4);
  return `(***) ***-${last4}`;
};

module.exports = {
  normalizePhone,
  maskPhone
};
