export function redact(text) {
  return String(text)
    .replace(
      /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b/g,
      "[REDACTED]",
    )
    .replace(
      /((?:api[_-]?key|password|secret|token)\s*[:=]\s*)["']?[^\s,"'\n}]+/gi,
      "$1[REDACTED]",
    );
}
