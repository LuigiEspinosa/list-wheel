import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { EntryEditorComponent } from './entry-editor.component';
import { EntryService } from '../../services/entry.service';

describe('EntryEditorComponent', () => {
  let fixture: ComponentFixture<EntryEditorComponent>;
  let comp: EntryEditorComponent;
  let svc: EntryService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EntryEditorComponent] });
    svc = TestBed.inject(EntryService);
    svc.loadFromText('Alice\nBob\nCarol');
    svc.openEditor();
    fixture = TestBed.createComponent(EntryEditorComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ---- seeding on mount ----

  describe('ngAfterViewInit seeding', () => {
    it('pre-fills the textarea with the current entries', () => {
      const ta = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
      expect(ta.value).toBe('Alice\nBob\nCarol');
    });

    it('places the caret at the end', () => {
      const ta = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
      expect(ta.selectionStart).toBe(ta.value.length);
      expect(ta.selectionEnd).toBe(ta.value.length);
    });
  });

  // ---- save and cancel ----

  describe('onCancel', () => {
    it('closes the editor without mutating entries', () => {
      comp.onCancel();
      expect(svc.isEditing()).toBeFalse();
      expect(svc.entries()).toEqual(['Alice', 'Bob', 'Carol']);
    });
  });

  describe('onSave', () => {
    it('writes the textarea contents back through saveEditorDraft', async () => {
      const ta = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
      ta.value = 'Alice\nBob\nCarol\nDave';
      await comp.onSave();
      expect(svc.entries()).toEqual(['Alice', 'Bob', 'Carol', 'Dave']);
      expect(svc.isEditing()).toBeFalse();
    });

    it('keeps the editor open when the draft exceeds MAX_BYTES', async () => {
      const ta = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
      ta.value = 'x'.repeat(21 * 1024 * 1024);
      await comp.onSave();
      expect(svc.isEditing()).toBeTrue();
      expect(svc.fileError()).not.toBeNull();
    });
  });

  // ---- find / replace ----

  describe('escapeRegExp', () => {
    it('escapes every regex metacharacter', () => {
      expect(comp.escapeRegExp('a.b')).toBe('a\\.b');
      expect(comp.escapeRegExp('(x)')).toBe('\\(x\\)');
      expect(comp.escapeRegExp('$50')).toBe('\\$50');
      expect(comp.escapeRegExp('a|b')).toBe('a\\|b');
    });
  });

  describe('onReplaceAll', () => {
    it('flashes "no matches" when nothing is found', fakeAsync(() => {
      comp.findText.set('zzz');
      comp.onReplaceAll();
      expect(comp.noMatchHint()).toBeTrue();

      tick(2000);
      expect(comp.noMatchHint()).toBeFalse();
    }));

    it('does nothing when the find input is empty', () => {
      comp.findText.set('');
      comp.onReplaceAll();
      const ta = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
      expect(ta.value).toBe('Alice\nBob\nCarol');
    });

    it('treats the replacement as literal even when it contains $ characters', () => {
      spyOn(document, 'execCommand').and.returnValue(false);
      spyOn(console, 'warn');

      const ta = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
      ta.value = 'price 10\nprice 20';

      comp.findText.set('price');
      comp.replaceText.set('$&amount');
      comp.onReplaceAll();

      expect(ta.value).toBe('$&amount 10\n$&amount 20');
    });

    it('respects match case when enabled', () => {
      spyOn(document, 'execCommand').and.returnValue(false);
      const ta = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
      ta.value = 'Apple\napple';

      comp.findText.set('Apple');
      comp.replaceText.set('Banana');
      comp.matchCase.set(true);
      comp.onReplaceAll();

      expect(ta.value).toBe('Banana\napple');
    });

    it('is case-insensitive when match case is off', () => {
      spyOn(document, 'execCommand').and.returnValue(false);
      const ta = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
      ta.value = 'Apple\napple';

      comp.findText.set('apple');
      comp.replaceText.set('Banana');
      comp.matchCase.set(false);
      comp.onReplaceAll();

      expect(ta.value).toBe('Banana\nBanana');
    });

    it('preserves scroll position across the replace', () => {
      spyOn(document, 'execCommand').and.returnValue(false);
      const ta = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
      let stored = 42;
      Object.defineProperty(ta, 'scrollTop', {
        get: () => stored,
        set: (v: number) => {
          stored = v;
        },
        configurable: true,
      });

      comp.findText.set('Alice');
      comp.replaceText.set('Zed');
      comp.onReplaceAll();

      expect(stored).toBe(42);
    });
  });

  // ---- keyboard shortcuts ----

  describe('onKeyDown', () => {
    it('Escape cancels the editor', () => {
      comp.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(svc.isEditing()).toBeFalse();
    });

    it('Ctrl + Enter saves', async () => {
      const ta = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
      ta.value = 'Alice\nBob';
      const ev = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true });
      comp.onKeydown(ev);
      await Promise.resolve();
      expect(svc.entries()).toEqual(['Alice', 'Bob']);
    });
  });
});
