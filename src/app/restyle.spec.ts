import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { EntryService } from './services/entry.service';

// The Cuatro restyle's floor, read off the rendered page rather than the CSS
// (cuatro-portfolio RESTYLE-SPEC.md, § 1 Control, § 9 Field, F-4, F-5, F-7, F-10, F-11).
describe('Cuatro restyle', () => {
  function render(edit = false): HTMLElement {
    TestBed.configureTestingModule({ imports: [AppComponent] });
    const svc = TestBed.inject(EntryService);
    svc.loadFromText('Alpha\nBravo\nCharlie');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    // The wheel clears the winner when the entries change, so it is set after the first pass.
    svc.lastWinner.set('Alpha');
    if (edit) svc.openEditor();
    fixture.detectChanges();
    // F-5 is read at rest: the ring's --r-hair belongs to the focused state only.
    (document.activeElement as HTMLElement | null)?.blur();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders every control unfilled, square, unshadowed and at least --tap on both axes', () => {
    const controls = [...render().querySelectorAll<HTMLElement>('button, a.link-btn')];
    expect(controls.map((c) => c.textContent?.trim())).toContain('Search on Google');
    for (const el of controls) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const label = el.textContent?.trim();
      expect(cs.backgroundColor).withContext(`${label} ground`).toBe('rgba(0, 0, 0, 0)');
      expect(cs.borderTopLeftRadius).withContext(`${label} radius`).toBe('0px');
      expect(cs.boxShadow).withContext(`${label} shadow`).toBe('none');
      expect(cs.transitionProperty).withContext(`${label} transition`).toBe('border-color');
      expect(r.width).withContext(`${label} width`).toBeGreaterThanOrEqual(44);
      expect(r.height).withContext(`${label} height`).toBeGreaterThanOrEqual(44);
    }
  });

  it('draws no radius and no shadow on any element, and sets color-scheme dark', () => {
    const root = render();
    for (const el of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
      const cs = getComputedStyle(el);
      expect(cs.borderTopLeftRadius).withContext(el.className || el.tagName).toBe('0px');
      expect(cs.boxShadow).withContext(el.className || el.tagName).toBe('none');
    }
    expect(getComputedStyle(document.documentElement).colorScheme).toBe('dark');
  });

  it('renders every field square on the page ground at least --tap tall', () => {
    const root = render(true);
    const ground = getComputedStyle(document.body).backgroundColor;
    const fields = [...root.querySelectorAll<HTMLElement>('input[type="text"], textarea')];
    expect(fields.length).toBe(3);
    for (const el of fields) {
      const cs = getComputedStyle(el);
      expect(cs.borderTopLeftRadius).toBe('0px');
      expect(cs.backgroundColor).toBe(ground);
      expect(el.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  });
});
