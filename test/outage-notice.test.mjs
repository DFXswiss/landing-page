import { describe, expect, test } from 'vitest';

// Importing the classic script runs it against the jsdom window and exposes the
// helpers on window.DfxOutageNotice without any side effects.
import '../js/lib/outage-notice.js';

const { OUTAGE_NOTICE_END, isOutageNoticeActive, millisecondsUntilOutageNoticeEnd } =
  window.DfxOutageNotice;

describe('OUTAGE_NOTICE_END', () => {
  test('is 19 November 2026, 09:00 CET', () => {
    expect(OUTAGE_NOTICE_END.toISOString()).toBe('2026-11-19T08:00:00.000Z');
  });
});

describe('isOutageNoticeActive', () => {
  test('is active one millisecond before the end', () => {
    expect(isOutageNoticeActive(new Date('2026-11-19T07:59:59.999Z'))).toBe(true);
  });

  test('is inactive exactly at the end', () => {
    expect(isOutageNoticeActive(new Date('2026-11-19T08:00:00.000Z'))).toBe(false);
  });

  test('is inactive after the end', () => {
    expect(isOutageNoticeActive(new Date('2026-11-20T00:00:00.000Z'))).toBe(false);
  });
});

describe('millisecondsUntilOutageNoticeEnd', () => {
  test('returns 1000 one second before the end', () => {
    expect(millisecondsUntilOutageNoticeEnd(new Date('2026-11-19T07:59:59.000Z'))).toBe(1000);
  });

  test('returns 0 exactly at the end', () => {
    expect(millisecondsUntilOutageNoticeEnd(new Date('2026-11-19T08:00:00.000Z'))).toBe(0);
  });

  test('returns a negative number after the end', () => {
    expect(millisecondsUntilOutageNoticeEnd(new Date('2026-11-19T08:00:01.000Z'))).toBe(-1000);
  });
});
