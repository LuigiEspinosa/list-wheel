import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WheelSvgComponent } from './wheel-svg.component';
import { EntryService } from '../../services/entry.service';

describe('WheelSvgComponent', () => {
  let fixture: ComponentFixture<WheelSvgComponent>;
  let comp: WheelSvgComponent;
  let svc: EntryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(WheelSvgComponent);
    comp = fixture.componentInstance;
    svc = TestBed.inject(EntryService);
    fixture.detectChanges();
  });

  // ---- fitLabel ----

  describe('fitLabel', () => {
    it('returns text unchanged when within limit', () => {
      expect(comp.fitLabel('Alice', 10)).toBe('Alice');
    });

    it('returns text unchanged at exact limit', () => {
      expect(comp.fitLabel('Alice', 5)).toBe('Alice');
    });

    it('truncates and appends ellipsis when over limit', () => {
      expect(comp.fitLabel('Hello World', 6)).toBe('Hello…');
    });

    it('returns ellipsis when maxChars is 1', () => {
      expect(comp.fitLabel('Alice', 1)).toBe('…');
    });

    it('returns ellipsis when maxChars is 0', () => {
      expect(comp.fitLabel('Alice', 0)).toBe('…');
    });
  });

  // ---- labelFontSize ----

  describe('labelFontSize', () => {
    it('returns 3.2 for step > 0.08', () => {
      expect(comp.labelFontSize(0.09)).toBe(3.2);
    });

    it('returns 2.8 for step in (0.04, 0.08]', () => {
      expect(comp.labelFontSize(0.05)).toBe(2.8);
    });

    it('returns 2.8 at the upper boundary 0.08', () => {
      expect(comp.labelFontSize(0.08)).toBe(2.8);
    });

    it('returns 2.4 for step <= 0.04', () => {
      expect(comp.labelFontSize(0.01)).toBe(2.4);
    });

    it('returns 2.4 at the boundary 0.04', () => {
      expect(comp.labelFontSize(0.04)).toBe(2.4);
    });
  });

  // ---- labelMaxChars ----

  describe('labelMaxChars', () => {
    it('returns at least 4 for any step', () => {
      expect(comp.labelMaxChars(0.001)).toBeGreaterThanOrEqual(4);
      expect(comp.labelMaxChars(0.5)).toBeGreaterThanOrEqual(4);
    });

    it('fits fewer characters per label when the font is larger (sparse wheel)', () => {
      const smallStep = comp.labelMaxChars(0.01); // small font -> more chars
      const largeStep = comp.labelMaxChars(0.3); // large font -> fewer chars
      expect(smallStep).toBeGreaterThanOrEqual(largeStep);
    });
  });

  // ---- computed: n, step, angleDeg ----

  describe('n()', () => {
    it('returns 1 when entries are empty (prevents division by zero)', () => {
      expect(comp.n()).toBe(1);
    });

    it('matches the number of loaded entries', () => {
      svc.loadFromText('A\nB\nC');
      expect(comp.n()).toBe(3);
    });
  });

  describe('step()', () => {
    it('equals 2π for a single entry', () => {
      expect(comp.step()).toBeCloseTo(2 * Math.PI);
    });

    it('equals 2π / n for multiple entries', () => {
      svc.loadFromText('A\nB\nC\nD');
      expect(comp.step()).toBeCloseTo((2 * Math.PI) / 4);
    });
  });

  describe('angleDeg()', () => {
    it('is 0 on init', () => {
      expect(comp.angleDeg()).toBe(0);
    });

    it('converts radians to degrees', () => {
      comp.angle.set(Math.PI);
      expect(comp.angleDeg()).toBeCloseTo(180);
    });
  });

  // ---- lineIndices / labelIndices ----

  describe('lineIndices()', () => {
    it('contains at least one index', () => {
      expect(comp.lineIndices().length).toBeGreaterThanOrEqual(1);
    });

    it('does not exceed n', () => {
      svc.loadFromText('A\nB\nC');
      expect(comp.lineIndices().length).toBeLessThanOrEqual(comp.n());
    });
  });

  describe('labelIndices()', () => {
    it('contains at least one index', () => {
      svc.loadFromText('A\nB\nC');
      expect(comp.labelIndices().length).toBeGreaterThanOrEqual(1);
    });

    it('does not exceed maxLabelsTarget for large lists', () => {
      const many = Array.from({ length: 500 }, (_, i) => `Entry ${i}`).join('\n');
      svc.loadFromText(many);
      expect(comp.labelIndices().length).toBeLessThanOrEqual(comp.maxLabelsTarget);
    });
  });

  // ---- radialLabel ----

  describe('radialLabel()', () => {
    it('returns the entry text for the given index', () => {
      svc.loadFromText('Alice\nBob');
      expect(comp.radialLabel(0)).toBe('Alice');
      expect(comp.radialLabel(1)).toBe('Bob');
    });

    it('truncates long entries', () => {
      svc.loadFromText('A'.repeat(100));
      const label = comp.radialLabel(0);
      expect(label.length).toBeLessThan(100);
      expect(label.endsWith('…')).toBeTrue();
    });

    it('returns empty string for out-of-range index', () => {
      expect(comp.radialLabel(99)).toBe('');
    });
  });

  // ---- spin ----

  describe('spin()', () => {
    it('does not spin when no entries are loaded', () => {
      comp.spin();
      expect(comp.spinning()).toBeFalse();
    });

    it('does nothing if already spinning', () => {
      svc.loadFromText('Alice\nBob');
      comp.spin();
      const velocityAfterFirst = comp['angularVelocity'];
      comp.spin();
      expect(comp['angularVelocity']).toBe(velocityAfterFirst);
      comp['stop']();
    });

    it('sets spinning to true when entries are loaded', () => {
      svc.loadFromText('Alice\nBob');
      comp.spin();
      expect(comp.spinning()).toBeTrue();
      comp['stop']();
    });

    it('ignores a second call while already spinning', () => {
      svc.loadFromText('Alice\nBob');
      comp.spin();
      const velocityAfterFirst = comp['angularVelocity'];
      comp.spin();
      expect(comp['angularVelocity']).toBe(velocityAfterFirst);
      comp['stop']();
    });
  });

  // ---- winnerSize tiers ----
  it('returns "sm" when there is no winner', () => {
    svc.lastWinner.set(null);
    expect(comp.winnerSize()).toBe('sm');
  });

  it('returns "lg" for names up to 12 chars', () => {
    svc.lastWinner.set('Alice Smith');
    expect(comp.winnerSize()).toBe('lg');
    svc.lastWinner.set('123456789012');
    expect(comp.winnerSize()).toBe('lg');
  });

  it('returns "md" for names 13-24 chars', () => {
    svc.lastWinner.set('1234567890123');
    expect(comp.winnerSize()).toBe('md');
    svc.lastWinner.set('123456789012345678901234');
    expect(comp.winnerSize()).toBe('md');
  });

  it('returns "sm" for names 25-40 chars', () => {
    svc.lastWinner.set('1234567890123456789012345');
    expect(comp.winnerSize()).toBe('sm');
    svc.lastWinner.set('1234567890123456789012345678901234567890');
    expect(comp.winnerSize()).toBe('sm');
  });

  it('retuns "xs" for names over 40 chars', () => {
    svc.lastWinner.set('12345678901234567890123456789012345678901');
    expect(comp.winnerSize()).toBe('xs');
  });

  it('renders the winner badge in the DOM when a winner is set', () => {
    svc.loadFromText('Alice');
    fixture.detectChanges();
    svc.lastWinner.set('Alice');
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.winner-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('Alice');
  });

  it('does not render the winner badge when no winner is set', () => {
    svc.loadFromText('Alice');
    fixture.detectChanges();
    svc.lastWinner.set(null);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.winner-badge');
    expect(badge).toBeNull();
  });
});
