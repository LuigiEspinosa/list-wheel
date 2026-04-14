import { computed, Injectable, signal } from '@angular/core';

export interface WinnerRecord {
  text: string;
  timestamp: number;
  order: number;
}

@Injectable({ providedIn: 'root' })
export class EntryService {
  readonly entries = signal<string[]>([]);
  readonly hasEntries = computed(() => this.entries().length > 0);
  readonly lastWinner = signal<string | null>(null);
  readonly history = signal<WinnerRecord[]>([]);
  readonly supportsFileSystemAccess = 'showOpenFilePicker' in window;
  readonly fileError = signal<string | null>(null);
  readonly popupBlocked = signal(false);
  readonly isEditing = signal(false);

  private winCounter = 0;
  private writing = false;
  private pendingWrite = false;
  private fileHandle = signal<FileSystemFileHandle | null>(null);
  private popupBlockedTimer: ReturnType<typeof setTimeout> | null = null;

  private static readonly MAX_BYTES = 20 * 1024 * 1024;

  readonly hasFileHandle = computed(() => this.fileHandle() !== null);
  readonly isWinnerUrl = computed(() => this.winnerUrls().length > 0);

  readonly winnerUrls = computed(() => {
    const w = this.lastWinner();
    if (!w) return [];
    return w.split(/\s+/).filter((token) => {
      try {
        const url = new URL(token);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    });
  });

  loadFromText(raw: string) {
    if (raw.length > EntryService.MAX_BYTES) {
      this.fileError.set('File is too large. Keep it under 20 MB.');
      return;
    }

    const lines = raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const seen = new Set<string>();

    const unique = lines.filter((line) => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    });

    this.entries.set(unique);
    this.lastWinner.set(null);
    this.history.set([]);
    this.winCounter = 0;
  }

  mulberry32(seed: number) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  shuffle() {
    const arr = this.entries().slice();
    const seedBuf = new Uint32Array(1);
    crypto.getRandomValues(seedBuf);
    const rand = this.mulberry32(seedBuf[0] ^ Date.now());

    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    this.entries.set(arr);
  }

  clear() {
    this.entries.set([]);
    this.lastWinner.set(null);
    this.history.set([]);
    this.winCounter = 0;
  }

  openInTab(url: string): void {
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) this.flagPopupBlocked();
  }

  searchWinnerOnGoogle(): void {
    const w = this.lastWinner();
    if (!w) return;
    const win = window.open(
      `https://www.google.com/search?q=${encodeURIComponent(w)}`,
      '_blank',
      'noopener,noreferrer',
    );
    if (!win) this.flagPopupBlocked();
  }

  /**
   * Open the inline editor. No-op when the list is empty, because the
   * textarea would be balnk and the Edit button is already disabled in
   * that case.
   *
   * This guard is a blet-and-braces check for programmatic callers.
   */
  openEditor(): void {
    if (this.entries().length === 0) return;
    this.isEditing.set(true);
  }

  /** Close the editor without mutating entries. */
  closeEditor(): void {
    this.isEditing.set(false);
  }

  async copyWinner(): Promise<boolean> {
    const text = this.lastWinner();
    if (!text) return false;

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';

        document.body.appendChild(ta);
        ta.select();

        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  }

  async copyWinnerAndRemove(): Promise<boolean> {
    const text = this.lastWinner();
    if (!text) return false;

    const ok = await this.copyWinner();
    if (!ok) return false;

    await this.finalizeWinner(text);
    return true;
  }

  async removeWinner(): Promise<void> {
    const text = this.lastWinner();
    if (!text) return;
    await this.finalizeWinner(text);
  }

  async openFile(): Promise<void> {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Text files', accept: { 'text/plain': ['.txt'] } }],
      multiple: false,
    });

    // * Ask for write permission up front. If the user declines we still
    //   load the file for this session, but we clear the handle so
    //   syncToFile becomes a no-op and the UI explains why
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      this.fileHandle.set(null);
      this.fileError.set('Write permission denied - real-time file sync disabled for this file.');
      const file = await handle.getFile();
      this.loadFromText(await file.text());
      return;
    }

    this.fileError.set(null);
    this.fileHandle.set(handle);
    const file = await handle.getFile();
    this.loadFromText(await file.text());
  }

  /**
   * Apply a draft from the editor through the same parsing path as a
   * fresh file upload, then push the result to be linked file when one
   * is attached. Returning void keeps callers simple.
   *
   * Errors still flow through fileError() the same way upload erros do.
   */
  async saveEditorDraft(raw: string): Promise<void> {
    const historySnapshot = this.history();
    const lastWinnerSnapshot = this.lastWinner();
    const winCounterSnapshot = this.winCounter;

    this.loadFromText(raw);
    if (this.fileError()) return;

    this.history.set(historySnapshot);
    this.winCounter = winCounterSnapshot;

    if (lastWinnerSnapshot && this.entries().includes(lastWinnerSnapshot)) {
      this.lastWinner.set(lastWinnerSnapshot);
    } else {
      this.lastWinner.set(null);
    }

    await this.syncIfLinked();
    this.isEditing.set(false);
  }

  private flagPopupBlocked(): void {
    this.popupBlocked.set(true);
    if (this.popupBlockedTimer) clearTimeout(this.popupBlockedTimer);
    // * Auto-clear after 5s so the banner does not linger after the user
    //   has granted the popup permission and moved on.
    this.popupBlockedTimer = setTimeout(() => this.popupBlocked.set(false), 5000);
  }

  private async finalizeWinner(text: string): Promise<void> {
    const arr = this.entries().slice();
    const idx = arr.indexOf(text);

    // * If entries changed mid-spin the winner may already be gone.
    //   Clear UI state and bail withot writing a ghost history entry
    //   or advancing the win counter.
    if (idx < 0) {
      this.lastWinner.set(null);
      return;
    }

    arr.splice(idx, 1);
    this.entries.set(arr);

    this.winCounter += 1;
    this.history.update((h) => [{ text, timestamp: Date.now(), order: this.winCounter }, ...h]);
    this.lastWinner.set(null);
    await this.syncToFile();
  }

  private async syncToFile(): Promise<void> {
    const handle = this.fileHandle();
    if (!handle) return;

    // * Serialize writes: the FSA writable is locked while open, but a
    //   burst of clicks can still queue multiple createWritable calls.
    //   We collapse a burst into on trailing write - last-write-wins is
    //   correct for a single-user wheel.
    if (this.writing) {
      this.pendingWrite = true;
      return;
    }
    this.writing = true;

    try {
      const writable = await handle.createWritable();
      await writable.write(this.entries().join('\n'));
      await writable.close();
      this.fileError.set(null);
    } catch (err) {
      // ! File write failures are user-visible - surface via signal,
      //   do not swallow.
      console.error('syncToFile failed', err);
      this.fileError.set(err instanceof Error ? err.message : 'Could not write to file.');
    } finally {
      this.writing = false;
      if (this.pendingWrite) {
        this.pendingWrite = false;
        await this.syncToFile();
      }
    }
  }

  /**
   * Write current entries to disk only when a FileSystemFileHandle is
   * attached. Thin wrapper so callers do not need to know about the
   * private syncToFile or read fileHandle directly.
   */
  private async syncIfLinked(): Promise<void> {
    if (!this.hasFileHandle()) return;
    await this.syncToFile();
  }
}
