import { computed, Injectable, signal } from "@angular/core";

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

  private winCounter = 0;

  loadFromText(raw: string) {
    const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const seen = new Set<string>();

    const unique = lines.filter(line => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    })

    this.entries.set(unique);
    this.lastWinner.set(null);
  }

  mulberry32(seed: number) {
    return function () {
      let t = (seed += 0x6D2B79F5);
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
    this.entries.set([])
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

    const arr = this.entries().slice();
    const idx = arr.indexOf(text);

    if (idx >= 0) {
      arr.splice(idx, 1);
      this.entries.set(arr);
    }

    this.winCounter += 1;
    const rec: WinnerRecord = {
      text,
      timestamp: Date.now(),
      order: this.winCounter
    }

    this.history.update(h => [rec, ...h]);
    this.lastWinner.set(null);
    return true;
  }
}
