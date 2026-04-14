import { Component, EventEmitter, inject, Output, signal } from '@angular/core';
import { EntryService } from '../../services/entry.service';
import { DatePipe, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-controls',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  templateUrl: './controls.component.html',
  styleUrls: ['./controls.component.css'],
})
export class ControlsComponent {
  private svc = inject(EntryService);
  @Output() spin = new EventEmitter<void>();

  copied = false;
  showHistory = false;
  readonly error = signal<string | null>(null);

  onShuffle() {
    this.svc.shuffle();
  }

  onSpin() {
    if (this.svc.hasEntries()) {
      this.spin.emit();
    }
  }

  onClear() {
    this.svc.clear();
  }

  toggleHistory() {
    this.showHistory = !this.showHistory;
  }

  onRemoveWinner(): void {
    this.svc.removeWinner();
  }

  onEdit(): void {
    this.svc.openEditor();
  }

  async onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const txt = await file.text();
      this.svc.loadFromText(txt);
      this.error.set(null);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not read file.');
    } finally {
      input.value = '';
    }
  }

  async onCopyWinner() {
    const ok = await this.svc.copyWinnerAndRemove();
    this.copied = ok;
    setTimeout(() => (this.copied = false), 1500);
  }

  async onOpenFile(): Promise<void> {
    try {
      await this.svc.openFile();
      this.error.set(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // ! Never re-throw here - re-throwing from an event hanlder becomes
      //   an unhandled promise rejection with no UI feedback.
      this.error.set(err instanceof Error ? err.message : 'Could not open file.');
    }
  }

  get banner(): string | null {
    return this.error() ?? this.svc.fileError();
  }

  get count() {
    return this.svc.entries().length;
  }

  get winner() {
    return this.svc.lastWinner();
  }

  get history() {
    return this.svc.history();
  }

  get winnerUrls(): string[] {
    return this.svc.winnerUrls();
  }

  get isWinnerUrl(): boolean {
    return this.svc.isWinnerUrl();
  }

  get supportsFileSystemAccess(): boolean {
    return this.svc.supportsFileSystemAccess;
  }

  get isEditing(): boolean {
    return this.svc.isEditing();
  }

  get googleSearchUrl(): string | null {
    return this.svc.googleSearchUrl();
  }
}
