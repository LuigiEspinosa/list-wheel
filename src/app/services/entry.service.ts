import { computed, Injectable, signal } from "@angular/core";

@Injectable({ providedIn: 'root' })

export class EntryService {
  readonly entries = signal<string[]>([]);
  readonly hasEntries = computed(() => this.entries().length > 0);
  readonly lastWinner = signal<string | null>(null);

  loadFromText(raw: string) {
    const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const seen = new Set<string>();

    const unique = lines.filter(line => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    })

    this.entries.set(unique);
  }

  shuffle() {
    const arr = this.entries().slice();

    for (let i = arr.length - 1; i > 0; i--) {
      const r = crypto.getRandomValues(new Uint32Array(i))[0] / 2 ** 32;
      const j = Math.floor(r * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    this.entries.set(arr);
  }

  clear() {
    this.entries.set([])
  }

  async copyWinner(): Promise<boolean> {
    const text = this.lastWinner();
    if (!text) return false;

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}
