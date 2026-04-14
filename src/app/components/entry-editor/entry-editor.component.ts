import { AfterViewInit, Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { EntryService } from '../../services/entry.service';

/**
 * Inline entry editor. Mounted by AppComponent only while
 * EntryService.isEditing() is true; destroyed on cance/save.
 *
 * Lifecycle:
 *    - ngAfterViewInit seeds the textarea exactly once per open because
 *      the component only exists during an edit session. No need for
 *      afterNextRender, no need for a signal effect - the component's
 *      lifecycle already encondes the "open -> mount -> seed -> close ->
 *      unmount" sequence for free.
 *
 * Responsibility:
 *    - Read current entries, presnet them as editable text.
 *    - Offer find/replace and save/cancel.
 *    - Commit via EntryService.saveEditorDraft on save.
 *    - Call EntryService.closeEditor on cancel or successful save.
 */
@Component({
  selector: 'app-entry-editor',
  standalone: true,
  templateUrl: './entry-editor.component.html',
  styleUrls: ['./entry-editor.component.css'],
})
export class EntryEditorComponent implements AfterViewInit {
  private svc = inject(EntryService);

  @ViewChild('editorRef', { static: true })
  editorRef!: ElementRef<HTMLTextAreaElement>;

  readonly findText = signal('');
  readonly replaceText = signal('');
  readonly matchCase = signal(false);
  readonly noMatchHint = signal(false);

  private noMatchTimer: ReturnType<typeof setTimeout> | null = null;

  ngAfterViewInit(): void {
    const ta = this.editorRef.nativeElement;
    ta.value = this.svc.entries().join('\n');
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  onCancel(): void {
    this.svc.closeEditor();
  }

  async onSave(): Promise<void> {
    const raw = this.editorRef.nativeElement.value;
    await this.svc.saveEditorDraft(raw);
  }

  /**
   * Editor-level keyboard shortcuts:
   *    Escape            - cancel
   *    Ctrl/Cmd+Enter    - save
   *
   * Native Ctrl/Cmd+z and Ctrl/Cmd+Shift+Z are handled by the browser
   * on the focused textarea. We intentionally do not preventDefault on them.
   */
  onKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.onCancel();
      return;
    }

    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
      ev.preventDefault();
      this.onSave();
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

    const replacement = this.replaceText();
    const next = current.replace(re, () => replacement);

    const savedScroll = ta.scrollTop;

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
    ta.scrollTop = savedScroll;
  }

  escapeRegExp(s: string): string {
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

  get canReplace(): boolean {
    return this.findText().length > 0;
  }
}
