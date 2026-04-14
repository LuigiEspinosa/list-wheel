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

  private winCounter = 0;
  private writing = false;
  private pendingWrite = false;
  private fileHandle = signal<FileSystemFileHandle | null>(null);

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

  async openFile(): Promise<void> {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Text files', accept: { 'text/plain': ['.txt'] } }],
      multiple: false,
    });

    this.fileHandle.set(handle);
    const file = await handle.getFile();
    this.loadFromText(await file.text());
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

  openInTab(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  searchWinnerOnGoogle(): void {
    const w = this.lastWinner();
    if (!w) return;
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(w)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }
}
