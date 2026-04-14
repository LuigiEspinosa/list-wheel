import { TestBed } from '@angular/core/testing';
import { EntryService } from './entry.service';

describe('EntryService', () => {
  let svc: EntryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(EntryService);
  });

  // ---- loadFromText ----

  describe('loadFromText', () => {
    it('splits on newlines and trims whitespace', () => {
      svc.loadFromText('  Alice  \nBob\n  Carol  ');
      expect(svc.entries()).toEqual(['Alice', 'Bob', 'Carol']);
    });

    it('handles \\r\\n line endings', () => {
      svc.loadFromText('Alice\r\nBob');
      expect(svc.entries()).toEqual(['Alice', 'Bob']);
    });

    it('deduplicates preserving first occurrence', () => {
      svc.loadFromText('Alice\nBob\nAlice\nBob');
      expect(svc.entries()).toEqual(['Alice', 'Bob']);
    });

    it('filters blank and whitespace-only lines', () => {
      svc.loadFromText('Alice\n\n   \nBob\n\n');
      expect(svc.entries()).toEqual(['Alice', 'Bob']);
    });

    it('clears lastWinner on load', () => {
      svc.lastWinner.set('Alice');
      svc.loadFromText('Bob');
      expect(svc.lastWinner()).toBeNull();
    });
  });

  // ---- hasEntries ----

  describe('hasEntries', () => {
    it('is false when empty', () => {
      expect(svc.hasEntries()).toBeFalse();
    });

    it('is true after loading', () => {
      svc.loadFromText('Alice');
      expect(svc.hasEntries()).toBeTrue();
    });

    it('is false after clear', () => {
      svc.loadFromText('Alice');
      svc.clear();
      expect(svc.hasEntries()).toBeFalse();
    });
  });

  // ---- shuffle ----

  describe('shuffle', () => {
    it('preserves all entries', () => {
      svc.loadFromText('A\nB\nC\nD\nE');
      const before = [...svc.entries()].sort();
      svc.shuffle();
      expect([...svc.entries()].sort()).toEqual(before);
    });

    it('produces a new array reference', () => {
      svc.loadFromText('A\nB');
      const ref = svc.entries();
      svc.shuffle();
      expect(svc.entries()).not.toBe(ref);
    });

    it('does not modify a single-entry list', () => {
      svc.loadFromText('Only');
      svc.shuffle();
      expect(svc.entries()).toEqual(['Only']);
    });
  });

  // ---- clear ----

  describe('clear', () => {
    it('empties entries', () => {
      svc.loadFromText('Alice\nBob');
      svc.clear();
      expect(svc.entries()).toEqual([]);
    });

    it('clears lastWinner', () => {
      svc.lastWinner.set('Alice');
      svc.clear();
      expect(svc.lastWinner()).toBeNull();
    });
  });

  // ---- mulberry32 ----

  describe('mulberry32', () => {
    it('is deterministic for the same seed', () => {
      const rng = svc.mulberry32(42);
      const a = [rng(), rng(), rng()];
      const rng2 = svc.mulberry32(42);
      const b = [rng2(), rng2(), rng2()];
      expect(a).toEqual(b);
    });

    it('produces values in [0, 1)', () => {
      const rng = svc.mulberry32(99);
      for (let i = 0; i < 20; i++) {
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });

    it('produces different sequences for different seeds', () => {
      const a = svc.mulberry32(1)();
      const b = svc.mulberry32(2)();
      expect(a).not.toBe(b);
    });
  });

  // ---- isWinnerUrl ----

  describe('winnerUrls', () => {
    it('returns empty array when no winner', () => {
      expect(svc.winnerUrls()).toEqual([]);
    });

    it('returns the URL when winner is a plain URL', () => {
      svc.lastWinner.set('https://example.com');
      expect(svc.winnerUrls()).toEqual(['https://example.com']);
    });

    it('extracts URL from text with pipe separator', () => {
      svc.lastWinner.set('https://example.com | Example Website');
      expect(svc.winnerUrls()).toEqual(['https://example.com']);
    });

    it('extracts multiple URLs when more than one is present', () => {
      svc.lastWinner.set('https://one.com https://two.com extra text');
      expect(svc.winnerUrls()).toEqual(['https://one.com', 'https://two.com']);
    });

    it('returns empty array for plain text', () => {
      svc.lastWinner.set('Alice from accounting');
      expect(svc.winnerUrls()).toEqual([]);
    });

    it('ignores ftp and other non-http protocols', () => {
      svc.lastWinner.set('ftp://files.example.com | files');
      expect(svc.winnerUrls()).toEqual([]);
    });
  });

  describe('isWinnerUrl', () => {
    it('is false when no winner', () => {
      expect(svc.isWinnerUrl()).toBeFalse();
    });

    it('is true when winner is a plain URL', () => {
      svc.lastWinner.set('https://example.com');
      expect(svc.isWinnerUrl()).toBeTrue();
    });

    it('is true when winner text contains a URL', () => {
      svc.lastWinner.set('https://music.apple.com/artist/123 | Artist on Apple Music');
      expect(svc.isWinnerUrl()).toBeTrue();
    });

    it('is false for plain text with no URL', () => {
      svc.lastWinner.set('Alice from accounting');
      expect(svc.isWinnerUrl()).toBeFalse();
    });

    it('is false for javascript protocol', () => {
      svc.lastWinner.set('javascript:alert(1)');
      expect(svc.isWinnerUrl()).toBeFalse();
    });
  });

  // ---- copyWinner ----

  describe('copyWinner', () => {
    it('returns false when no winner', async () => {
      expect(await svc.copyWinner()).toBeFalse();
    });

    it('writes to clipboard and returns true', async () => {
      spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
      svc.lastWinner.set('Alice');
      const ok = await svc.copyWinner();
      expect(ok).toBeTrue();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Alice');
    });

    it('returns false on clipboard failure with no fallback', async () => {
      spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.reject(new Error('denied')));
      // execCommand is not available in headless; spy to return false
      spyOn(document, 'execCommand').and.returnValue(false);
      svc.lastWinner.set('Alice');
      const ok = await svc.copyWinner();
      expect(ok).toBeFalse();
    });
  });

  // ---- copyWinnerAndRemove ----

  describe('copyWinnerAndRemove', () => {
    beforeEach(() => {
      spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
    });

    it('returns false when no winner', async () => {
      expect(await svc.copyWinnerAndRemove()).toBeFalse();
    });

    it('removes winner from entries', async () => {
      svc.loadFromText('Alice\nBob');
      svc.lastWinner.set('Alice');
      await svc.copyWinnerAndRemove();
      expect(svc.entries()).toEqual(['Bob']);
    });

    it('records winner in history (newest first)', async () => {
      svc.loadFromText('Alice\nBob');
      svc.lastWinner.set('Alice');
      await svc.copyWinnerAndRemove();
      expect(svc.history().length).toBe(1);
      expect(svc.history()[0].text).toBe('Alice');
    });

    it('clears lastWinner after removal', async () => {
      svc.loadFromText('Alice');
      svc.lastWinner.set('Alice');
      await svc.copyWinnerAndRemove();
      expect(svc.lastWinner()).toBeNull();
    });

    it('assigns monotonically increasing order across calls', async () => {
      svc.loadFromText('Alice\nBob');
      svc.lastWinner.set('Alice');
      await svc.copyWinnerAndRemove();
      svc.lastWinner.set('Bob');
      await svc.copyWinnerAndRemove();
      const [second, first] = svc.history();
      expect(first.order).toBe(1);
      expect(second.order).toBe(2);
    });

    it('returns false without removing when clipboard fails', async () => {
      (navigator.clipboard.writeText as jasmine.Spy).and.returnValue(Promise.reject(new Error()));
      spyOn(document, 'execCommand').and.returnValue(false);
      svc.loadFromText('Alice');
      svc.lastWinner.set('Alice');
      const ok = await svc.copyWinnerAndRemove();
      expect(ok).toBeFalse();
      expect(svc.entries()).toEqual(['Alice']);
    });
  });

  // ---- removeWinner ----

  describe('removeWinner', () => {
    it('does nothing when no winner is set', () => {
      svc.loadFromText('Alice');
      svc.removeWinner();
      expect(svc.entries()).toEqual(['Alice']);
      expect(svc.history().length).toBe(0);
    });

    it('removes the winner from entries', () => {
      svc.loadFromText('Alice\nBob');
      svc.lastWinner.set('Alice');
      svc.removeWinner();
      expect(svc.entries()).toEqual(['Bob']);
    });

    it('clears lastWinner', () => {
      svc.loadFromText('Alice');
      svc.lastWinner.set('Alice');
      svc.removeWinner();
      expect(svc.lastWinner()).toBeNull();
    });

    it('records the winner in history', () => {
      svc.loadFromText('Alice');
      svc.lastWinner.set('Alice');
      svc.removeWinner();
      expect(svc.history()[0].text).toBe('Alice');
    });

    it('does not use clipboard', () => {
      spyOn(navigator.clipboard, 'writeText');
      svc.loadFromText('Alice');
      svc.lastWinner.set('Alice');
      svc.removeWinner();
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });
  });

  // ---- googleSearchUrl ----

  describe('googleSearchUrl', () => {
    it('is null when there is no winner', () => {
      expect(svc.googleSearchUrl()).toBeNull();
    });

    it('builds a Google search URL for the current winner', () => {
      svc.lastWinner.set('hello world');
      expect(svc.googleSearchUrl()).toBe('https://www.google.com/search?q=hello%20world');
    });

    it('encodes special characters', () => {
      svc.lastWinner.set('C++ is great & fast');
      const url = svc.googleSearchUrl();
      expect(url).toContain(encodeURIComponent('C++ is great & fast'));
    });

    it('updates reactively when the winner changes', () => {
      svc.lastWinner.set('first');
      const a = svc.googleSearchUrl();
      svc.lastWinner.set('second');
      const b = svc.googleSearchUrl();
      expect(a).not.toBe(b);
      expect(b).toContain('second');
    });
  });

  // ---- openFile (File System Access API) ----

  describe('openFile', () => {
    it('loads entries from the selected file', async () => {
      const mockFile = new File(['Alice\nBob\nCarol'], 'list.txt', { type: 'text/plain' });
      const mockHandle = {
        getFile: () => Promise.resolve(mockFile),
        createWritable: () =>
          Promise.resolve({ write: () => Promise.resolve(), close: () => Promise.resolve() }),
        requestPermission: () => Promise.resolve('granted' as PermissionState),
      } as unknown as FileSystemFileHandle;

      spyOn(window, 'showOpenFilePicker').and.returnValue(Promise.resolve([mockHandle]));

      await svc.openFile();
      expect(svc.entries()).toEqual(['Alice', 'Bob', 'Carol']);
    });

    it('sets hasFileHandle to true after opening', async () => {
      const mockFile = new File(['A'], 'list.txt', { type: 'text/plain' });
      const mockHandle = {
        getFile: () => Promise.resolve(mockFile),
        createWritable: () =>
          Promise.resolve({ write: () => Promise.resolve(), close: () => Promise.resolve() }),
        requestPermission: () => Promise.resolve('granted' as PermissionState),
      } as unknown as FileSystemFileHandle;

      spyOn(window, 'showOpenFilePicker').and.returnValue(Promise.resolve([mockHandle]));

      expect(svc.hasFileHandle()).toBeFalse();
      await svc.openFile();
      expect(svc.hasFileHandle()).toBeTrue();
    });
  });

  // ---- Editor ----

  describe('openEditor / closeEditor', () => {
    it('openEditor is a no-op when entries are empty', () => {
      svc.openEditor();
      expect(svc.isEditing()).toBeFalse();
    });

    it('openEditor flips isEditing when entries exist', () => {
      svc.loadFromText('Alice');
      svc.openEditor();
      expect(svc.isEditing()).toBeTrue();
    });

    it('closeEditor flips isEditing back to false', () => {
      svc.loadFromText('Alice');
      svc.openEditor();
      svc.closeEditor();
      expect(svc.isEditing()).toBeFalse();
    });
  });

  describe('saveEditorDraft', () => {
    beforeEach(() => {
      svc.loadFromText('Alice\nBob\nCarol');
    });

    it('parses the draft through loadFromText semantics', async () => {
      await svc.saveEditorDraft('  Alice  \nBob\nCarol\nDave');
      expect(svc.entries()).toEqual(['Alice', 'Bob', 'Carol', 'Dave']);
    });

    it('closes the editor on success', async () => {
      svc.openEditor();
      await svc.saveEditorDraft('Alice\nBob');
      expect(svc.isEditing()).toBeFalse();
    });

    it('keeps the editor open when the draft exceeds MAX_BYTES', async () => {
      svc.openEditor();
      const huge = 'x'.repeat(21 * 1024 * 1024);
      await svc.saveEditorDraft(huge);
      expect(svc.isEditing()).toBeTrue();
      expect(svc.fileError()).not.toBeNull();
      expect(svc.entries()).toEqual(['Alice', 'Bob', 'Carol']);
    });

    it('preserves history acorss an edit', async () => {
      svc.lastWinner.set('Alice');
      svc.removeWinner();
      const hBefore = svc.history();
      expect(hBefore.length).toBe(1);

      svc.openEditor();
      await svc.saveEditorDraft('Bob\nCarol\nDave');
      expect(svc.history()).toEqual(hBefore);
    });

    it('preserves the winCounter across an edit', async () => {
      svc.lastWinner.set('Alice');
      svc.removeWinner();
      svc.lastWinner.set('Bob');
      svc.removeWinner();

      await svc.saveEditorDraft('Carol\nDave');
      svc.lastWinner.set('Carol');
      svc.removeWinner();
      const [latest] = svc.history();
      expect(latest.order).toBe(3);
    });

    it('reinstates lastWinner when the winner still exists in the new entries', async () => {
      svc.lastWinner.set('Alice');
      svc.openEditor();
      await svc.saveEditorDraft('Alice\nBob\nCarol\nDave');
      expect(svc.lastWinner()).toBe('Alice');
    });

    it('clears lastWinner when the winner was removed by the edit', async () => {
      svc.lastWinner.set('Alice');
      svc.openEditor();
      await svc.saveEditorDraft('Bob\nCarol');
      expect(svc.lastWinner()).toBeNull();
    });
  });
});
