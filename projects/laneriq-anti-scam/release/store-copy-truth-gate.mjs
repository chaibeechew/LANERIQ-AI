const FORBIDDEN_POSITIVE_CLAIMS = Object.freeze([
  /\b100\s*%\s*(?:protected|safe|secure)\b/i,
  /\bvirus[- ]?free\b/i,
  /\bhacker[- ]?proof\b/i,
  /\bguarantee(?:d|s)?\s+(?:protection|safety|security|theft prevention|remote-control prevention)\b/i,
  /\bimpossible\s+to\s+(?:stop|hack|compromise|control)\b/i,
  /\bBANKING_SAFE\b/i,
  /\bcompletely\s+(?:safe|secure|clean)\b/i,
]);

function isExplicitTruthBoundary(line) {
  return /\b(?:does not|do not|cannot|can not|must not|not a guarantee|unsupported|forbidden|never claim|cannot guarantee)\b/i.test(line);
}

export function evaluateStoreCopyTruth(copy) {
  const text = String(copy ?? '');
  const violations = [];
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || isExplicitTruthBoundary(line)) continue;
    for (const pattern of FORBIDDEN_POSITIVE_CLAIMS) {
      if (pattern.test(line)) {
        violations.push(Object.freeze({ line: index + 1, text: line, pattern: String(pattern) }));
      }
    }
  }
  return Object.freeze({
    passed: violations.length === 0,
    violations: Object.freeze(violations),
  });
}
