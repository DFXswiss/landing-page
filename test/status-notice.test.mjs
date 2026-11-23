import { describe, expect, it } from 'vitest';

// The lib is a classic browser script; importing it under jsdom defines the
// helpers on window.DfxStatusNotice without any side effects.
import '../js/lib/status-notice.js';

const { STATUS_PAGE_URL, INCIDENTS_URL, activeNoticeTitles } = window.DfxStatusNotice;

const incident = (overrides) => ({
  id: 1,
  title: 'Scheduled maintenance',
  active: true,
  pin: true,
  ...overrides,
});

describe('URLs', () => {
  it('point at the public status page and its notice list', () => {
    expect(STATUS_PAGE_URL).toBe('https://status.dfx.swiss/');
    expect(INCIDENTS_URL).toBe('https://status.dfx.swiss/api/status-page/dfx/incident-history');
  });
});

describe('activeNoticeTitles', () => {
  it('returns no titles when the status page lists no notices', () => {
    expect(activeNoticeTitles({ ok: true, incidents: [] })).toEqual([]);
  });

  it('returns the trimmed titles of active, pinned notices in the listed order', () => {
    expect(
      activeNoticeTitles({
        ok: true,
        incidents: [
          incident({ id: 3, title: ' Bank connection interrupted ' }),
          incident({ id: 2 }),
        ],
      }),
    ).toEqual(['Bank connection interrupted', 'Scheduled maintenance']);
  });

  it('leaves out resolved and unpinned notices', () => {
    expect(
      activeNoticeTitles({
        ok: true,
        incidents: [
          incident({ id: 1, title: 'Resolved', active: false }),
          incident({ id: 2, title: 'Unpinned', pin: false }),
          incident({ id: 3, title: 'Shown' }),
        ],
      }),
    ).toEqual(['Shown']);
  });

  it('does not read the title of a notice that is not shown', () => {
    expect(
      activeNoticeTitles({ ok: true, incidents: [incident({ title: '', active: false })] }),
    ).toEqual([]);
  });

  for (const payload of [null, undefined, 'ok', { ok: false, incidents: [] }, { incidents: [] }]) {
    it(`throws when the answer is not ok (${JSON.stringify(payload)})`, () => {
      expect(() => activeNoticeTitles(payload)).toThrow('did not answer with ok');
    });
  }

  for (const incidents of [undefined, null, {}, 'none']) {
    it(`throws when the incidents list is ${JSON.stringify(incidents)}`, () => {
      expect(() => activeNoticeTitles({ ok: true, incidents })).toThrow('has no incidents list');
    });
  }

  for (const title of [undefined, null, 7, '', '   ']) {
    it(`throws when an active notice has the title ${JSON.stringify(title)}`, () => {
      expect(() => activeNoticeTitles({ ok: true, incidents: [incident({ title })] })).toThrow(
        'an active notice has no title',
      );
    });
  }
});
