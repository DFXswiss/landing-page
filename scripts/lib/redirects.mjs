// `_redirects` parsing, extracted from scripts/check-site.mjs so the
// completeness gate and the redirect regression test share one source of
// truth for Cloudflare Pages matching semantics instead of each keeping its
// own copy of the regex.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function toRegex(source) {
  const pattern = source
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex metachars (keeps * : /)
    .replace(/:[A-Za-z0-9_]+/g, '[^/]+') // :placeholder → one path segment
    .replace(/\*/g, '.*'); // splat → rest of path
  return new RegExp(`^${pattern}$`);
}

// Cloudflare Pages evaluates `_redirects` top-to-bottom and applies the first
// matching rule, so the parsed list must preserve file order.
export function loadRedirectRules(root) {
  if (!existsSync(join(root, '_redirects'))) return [];
  const rules = [];
  for (const line of readFileSync(join(root, '_redirects'), 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [source, target, status] = trimmed.split(/\s+/);
    if (!source.startsWith('/')) continue;
    rules.push({ source, target, status: Number(status), regex: toRegex(source) });
  }
  return rules;
}

export function loadRedirectMatchers(root) {
  return loadRedirectRules(root).map((rule) => rule.regex);
}

// The first rule (in file order) whose source matches `pathname`, or
// `undefined` if none does — mirrors Cloudflare Pages' first-match-wins
// evaluation.
export function findMatchingRule(root, pathname) {
  return loadRedirectRules(root).find((rule) => rule.regex.test(pathname));
}
