const categorizeProviderError = (err) => {
  const message = String(err?.message || 'Unknown error');
  const lower = message.toLowerCase();
  const status = err?.status || err?.statusCode || err?.response?.status;
  const code = String(err?.code || '').toLowerCase();

  if (status === 429 || lower.includes('rate limit') || lower.includes('too many')) {
    return { errorCode: 'RATE_LIMITED', safeMessage: message };
  }

  if (
    lower.includes('invalid') ||
    lower.includes('bad destination') ||
    lower.includes('address') ||
    lower.includes('phone') ||
    lower.includes('email')
  ) {
    return { errorCode: 'INVALID_DESTINATION', safeMessage: message };
  }

  if (lower.includes('rejected') || lower.includes('bounce') || lower.includes('blocked')) {
    return { errorCode: 'PROVIDER_REJECTED', safeMessage: message };
  }

  if (['etimedout', 'econnreset', 'enotfound', 'eai_again'].includes(code)) {
    return { errorCode: 'TEMPORARY_FAILURE', safeMessage: message };
  }

  if (lower.includes('timeout') || lower.includes('temporar')) {
    return { errorCode: 'TEMPORARY_FAILURE', safeMessage: message };
  }

  return { errorCode: 'UNKNOWN', safeMessage: message };
};

module.exports = {
  categorizeProviderError
};
