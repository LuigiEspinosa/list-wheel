import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ControlsComponent } from './controls.component';
import { EntryService } from '../../services/entry.service';

describe('ControlsComponent', () => {
  let fixture: ComponentFixture<ControlsComponent>;
  let comp: ControlsComponent;
  let svc: EntryService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ControlsComponent] });
    fixture = TestBed.createComponent(ControlsComponent);
    comp = fixture.componentInstance;
    svc = TestBed.inject(EntryService);
    fixture.detectChanges();
  });

  // ---- getters ----

  describe('count', () => {
    it('returns 0 when empty', () => {
      expect(comp.count).toBe(0);
    });

    it('reflects loaded entries', () => {
      svc.loadFromText('Alice\nBob\nCarol');
      expect(comp.count).toBe(3);
    });
  });

  describe('winner', () => {
    it('is null initially', () => {
      expect(comp.winner).toBeNull();
    });

    it('reflects the current winner', () => {
      svc.lastWinner.set('Alice');
      expect(comp.winner).toBe('Alice');
    });
  });

  describe('isWinnerUrl', () => {
    it('is false when no winner', () => {
      expect(comp.isWinnerUrl).toBeFalse();
    });

    it('is true when winner is an https URL', () => {
      svc.lastWinner.set('https://example.com');
      expect(comp.isWinnerUrl).toBeTrue();
    });

    it('is false for plain text', () => {
      svc.lastWinner.set('Alice');
      expect(comp.isWinnerUrl).toBeFalse();
    });
  });

  describe('history', () => {
    it('returns empty array initially', () => {
      expect(comp.history).toEqual([]);
    });
  });

  // ---- onFileSelected ----

  describe('onFileSelected', () => {
    it('loads text from the selected file', async () => {
      const file = new File(['Alice\nBob'], 'list.txt', { type: 'text/plain' });
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', { value: [file] });

      comp.onFileSelected({ target: input } as unknown as Event);

      await file.text(); // let the internal .then() resolve
      await Promise.resolve();

      expect(svc.entries()).toEqual(['Alice', 'Bob']);
    });

    it('does nothing when no file is provided', () => {
      spyOn(svc, 'loadFromText');
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', { value: [] });

      comp.onFileSelected({ target: input } as unknown as Event);

      expect(svc.loadFromText).not.toHaveBeenCalled();
    });
  });

  // ---- onOpenFile ----

  describe('onOpenFile', () => {
    it('delegates to svc.openFile()', async () => {
      spyOn(svc, 'openFile').and.returnValue(Promise.resolve());
      await comp.onOpenFile();
      expect(svc.openFile).toHaveBeenCalled();
    });

    it('silently swallows AbortError when the picker is cancelled', async () => {
      const abort = new DOMException('User cancelled', 'AbortError');
      spyOn(svc, 'openFile').and.returnValue(Promise.reject(abort));
      await expectAsync(comp.onOpenFile()).toBeResolved();
    });

    it('propagates non-abort errors', async () => {
      spyOn(svc, 'openFile').and.returnValue(Promise.reject(new Error('disk error')));
      await comp.onOpenFile();
      expect(comp.error()).toBe('disk error');
    });
  });

  // ---- onShuffle ----

  describe('onShuffle', () => {
    it('delegates to svc.shuffle()', () => {
      spyOn(svc, 'shuffle');
      comp.onShuffle();
      expect(svc.shuffle).toHaveBeenCalled();
    });
  });

  // ---- onSpin ----

  describe('onSpin', () => {
    it('emits the spin event when entries exist', () => {
      svc.loadFromText('Alice\nBob');
      spyOn(comp.spin, 'emit');
      comp.onSpin();
      expect(comp.spin.emit).toHaveBeenCalled();
    });

    it('does not emit when no entries are loaded', () => {
      spyOn(comp.spin, 'emit');
      comp.onSpin();
      expect(comp.spin.emit).not.toHaveBeenCalled();
    });
  });

  // ---- onClear ----

  describe('onClear', () => {
    it('delegates to svc.clear()', () => {
      spyOn(svc, 'clear');
      comp.onClear();
      expect(svc.clear).toHaveBeenCalled();
    });
  });

  // ---- onCopyWinner ----

  describe('onCopyWinner', () => {
    it('sets copied to true on success', async () => {
      spyOn(svc, 'copyWinnerAndRemove').and.returnValue(Promise.resolve(true));
      await comp.onCopyWinner();
      expect(comp.copied).toBeTrue();
    });

    it('leaves copied false on failure', async () => {
      spyOn(svc, 'copyWinnerAndRemove').and.returnValue(Promise.resolve(false));
      await comp.onCopyWinner();
      expect(comp.copied).toBeFalse();
    });
  });

  // ---- onRemoveWinner ----

  describe('onRemoveWinner', () => {
    it('delegates to svc.removeWinner()', () => {
      spyOn(svc, 'removeWinner');
      comp.onRemoveWinner();
      expect(svc.removeWinner).toHaveBeenCalled();
    });
  });

  // ---- toggleHistory ----

  describe('toggleHistory', () => {
    it('flips showHistory from false to true', () => {
      expect(comp.showHistory).toBeFalse();
      comp.toggleHistory();
      expect(comp.showHistory).toBeTrue();
    });

    it('flips showHistory from true to false', () => {
      comp.showHistory = true;
      comp.toggleHistory();
      expect(comp.showHistory).toBeFalse();
    });
  });

  // ---- onEdit ----

  describe('onEdit', () => {
    it('Edit button is disabled when the list is empty', () => {
      const btn = fixture.nativeElement.querySelector('button:nth-of-type(5)');
      expect(btn.textContent.trim()).toBe('Edit');
      expect(btn.disabled).toBeTrue();
    });

    it('Edit button flips isEditing via the service', () => {
      svc.loadFromText('Alice');
      fixture.detectChanges();
      comp.onEdit();
      expect(svc.isEditing()).toBeTrue();
    });

    it('onEdit is a no-op when the list is empty', () => {
      comp.onEdit();
      expect(svc.isEditing()).toBeFalse();
    });
  });

  // ---- winner link rendering ----

  describe('winner link rendering', () => {
    beforeEach(() => {
      svc.loadFromText('Alice\nhttps://example.com');
    });

    it('renders a Google search anchor when the winner is plain text', () => {
      svc.lastWinner.set('Alice');
      fixture.detectChanges();
      const a = fixture.nativeElement.querySelector('a.link-btn') as HTMLAnchorElement;
      expect(a).not.toBeNull();
      expect(a.getAttribute('href')).toContain('google.com/search');
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('renders a direct link anchor when the winner is a URL', () => {
      svc.lastWinner.set('https://example.com');
      fixture.detectChanges();
      const a = fixture.nativeElement.querySelector('a.link-btn') as HTMLAnchorElement;
      expect(a).not.toBeNull();
      expect(a.getAttribute('href')).toContain('https://example.com');
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('does not render any link anchor when there is no winner', () => {
      svc.lastWinner.set(null);
      fixture.detectChanges();
      const a = fixture.nativeElement.querySelector('a.link-btn') as HTMLAnchorElement;
      expect(a).toBeNull();
    });

    it('clicking the anchor does not trigger any component click handler', () => {
      svc.lastWinner.set('Alice');
      fixture.detectChanges();
      const a = fixture.nativeElement.querySelector('a.link-btn') as HTMLAnchorElement;
      expect(a.getAttribute('ng-reflect-click')).toBeNull();
      const comp = fixture.componentInstance as unknown as Record<string, unknown>;
      expect(comp['onOpenInTab']).toBeUndefined();
      expect(comp['onSearchGoogle']).toBeUndefined();
    });
  });
});
