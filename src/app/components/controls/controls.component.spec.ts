import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ControlsComponent } from './controls.component';
import { EntryService } from '../../services/entry.service';

describe('ControlsComponent', () => {
  let fixture: ComponentFixture<ControlsComponent>;
  let comp: ControlsComponent;
  let svc: EntryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
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
      await expectAsync(comp.onOpenFile()).toBeRejected();
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

  // ---- onOpenInTab ----

  describe('onOpenInTab', () => {
    it('delegates to svc.openWinnerInTab()', () => {
      spyOn(svc, 'openWinnerInTab');
      comp.onOpenInTab();
      expect(svc.openWinnerInTab).toHaveBeenCalled();
    });
  });

  // ---- onSearchGoogle ----

  describe('onSearchGoogle', () => {
    it('delegates to svc.searchWinnerOnGoogle()', () => {
      spyOn(svc, 'searchWinnerOnGoogle');
      comp.onSearchGoogle();
      expect(svc.searchWinnerOnGoogle).toHaveBeenCalled();
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
});
