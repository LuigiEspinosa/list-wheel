import { Injectable, signal } from "@angular/core";

@Injectable({ providedIn: 'root' })

export class EntryService {
  readonly entries = signal<string[]>([]);

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
}
