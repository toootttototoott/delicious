const rateLimitBuckets = new Map();

export function getClientIp(request) {
  const forwardedFor = String(request?.headers?.["x-forwarded-for"] ?? "").trim();
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = String(request?.headers?.["x-real-ip"] ?? "").trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function checkRateLimit(key, options = {}) {
  const now = Date.now();
  const windowMs = normalizePositiveInteger(options.windowMs, 15 * 60 * 1000);
  const maxAttempts = normalizePositiveInteger(options.maxAttempts, 10);
  const blockMs = normalizePositiveInteger(options.blockMs, windowMs);

  pruneExpiredEntries(now);

  const bucket = rateLimitBuckets.get(key) ?? {
    attempts: [],
    blockedUntil: 0,
  };

  if (bucket.blockedUntil > now) {
    return buildLimitedResult(bucket.blockedUntil - now);
  }

  bucket.attempts = bucket.attempts.filter((attemptedAt) => attemptedAt > now - windowMs);
  bucket.attempts.push(now);

  if (bucket.attempts.length > maxAttempts) {
    bucket.blockedUntil = now + blockMs;
    rateLimitBuckets.set(key, bucket);
    return buildLimitedResult(blockMs);
  }

  rateLimitBuckets.set(key, bucket);
  return {
    limited: false,
    retryAfterSeconds: 0,
  };
}

export function clearRateLimit(key) {
  rateLimitBuckets.delete(key);
}

function buildLimitedResult(retryAfterMs) {
  return {
    limited: true,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  };
}

function pruneExpiredEntries(now) {
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    const attempts = (bucket.attempts ?? []).filter((attemptedAt) => attemptedAt > now - 24 * 60 * 60 * 1000);
    const blockedUntil = Number(bucket.blockedUntil ?? 0);

    if (!attempts.length && blockedUntil <= now) {
      rateLimitBuckets.delete(key);
      continue;
    }

    bucket.attempts = attempts;
    bucket.blockedUntil = blockedUntil;
    rateLimitBuckets.set(key, bucket);
  }
}

function normalizePositiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}
