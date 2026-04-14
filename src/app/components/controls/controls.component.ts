import {
  AfterViewInit,
  Component,
  effect,
  ElementRef,
  EventEmitter,
  inject,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
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

  @ViewChild('editorRef') editorRef?: ElementRef<HTMLTextAreaElement>;

  readonly error = signal<string | null>(null);
  readonly findText = signal('');
  readonly replaceText = signal('');
  readonly matchCase = signal(false);
  readonly noMatchHint = signal(false);

  private noMatchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const open = this.svc.isEditing();
      if (!open) return;

      queueMicrotask(() => {
        const ta = this.editorRef?.nativeElement;
        if (!ta) return;
        ta.value = this.svc.entries().join('\n');
        ta.focus();
      });
    });
  }

  ngAfterViewInit(): void {
    // Left intentionally empty.
    // Seeding happens in the effect above so
    // it re-runs on every open, not just the first one.
  }

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

  onOpenInTab(url: string): void {
    this.svc.openInTab(url);
  }

  onSearchGoogle(): void {
    this.svc.searchWinnerOnGoogle();
  }

  onRemoveWinner(): void {
    this.svc.removeWinner();
  }

  onEdit(): void {
    this.resetFindReplace();
    this.svc.openEditor();
  }

  onCancelEdit(): void {
    this.svc.closeEditor();
    this.resetFindReplace();
  }

  /**
   * Editor-level keyboard shortcuts:
   *    Escape            - cancel
   *    Ctrl/Cmd+Enter    - save
   *
   * Native Ctrl/Cmd+z and Ctrl/Cmd+Shift+Z are handled by the browser
   * on the focused textarea. We intentionally do not preventDefault on them.
   */
  onDraftKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.onCancelEdit();
      return;
    }

    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
      ev.preventDefault();
      this.onSaveEdit();
    }
  }

  onFindInput(ev: Event): void {
    this.findText.set((ev.target as HTMLInputElement).value);
  }

  onReplaceInput(ev: Event): void {
    this.replaceText.set((ev.target as HTMLInputElement).value);
  }

  onMatchCaseToggle(ev: Event): void {
    this.matchCase.set((ev.target as HTMLInputElement).checked);
  }

  /**
   * Replace every ocurrence of findText with replaceText in the
   * textarea, in place, as a single undo step.
   */
  onReplaceAll(): void {
    const ta = this.editorRef?.nativeElement;
    const needle = this.findText();
    if (!ta || !needle) return;

    const current = ta.value;
    const flags = this.matchCase() ? 'g' : 'gi';
    const escaped = this.escapeRegExp(needle);
    const re = new RegExp(escaped, flags);

    if (!re.test(current)) {
      this.flashNoMatch();
      return;
    }

    const next = current.replace(re, this.replaceText());

    ta.focus();
    ta.select();
    const ok = document.execCommand('insertText', false, next);
    if (!ok) {
      console.warn(
        'controls: execCommand insertText reject by the browser. falling back to direct assignment (undo history will be cleared)',
      );
      ta.value = next;
    }
    ta.setSelectionRange(0, 0);
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

  async onSaveEdit(): Promise<void> {
    const ta = this.editorRef?.nativeElement;
    const raw = ta?.value ?? '';
    await this.svc.saveEditorDraft(raw);
    if (!this.svc.isEditing) this.resetFindReplace();
  }

  private escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private flashNoMatch(): void {
    this.noMatchHint.set(true);
    if (this.noMatchTimer) clearTimeout(this.noMatchTimer);
    this.noMatchTimer = setTimeout(() => {
      this.noMatchHint.set(false);
      this.noMatchTimer = null;
    }, 2000);
  }

  private resetFindReplace(): void {
    this.findText.set('');
    this.replaceText.set('');
    this.matchCase.set(false);
    this.noMatchHint.set(false);
    if (this.noMatchTimer) {
      clearTimeout(this.noMatchTimer);
      this.noMatchTimer = null;
    }
  }

  get banner(): string | null {
    return (
      this.error() ??
      this.svc.fileError() ??
      (this.svc.popupBlocked() ? 'Popup blocked - allow popups for this site.' : null)
    );
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

  get canReplace(): boolean {
    return this.findText().length > 0;
  }
}
