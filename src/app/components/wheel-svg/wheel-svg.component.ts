import { Component, computed, effect, inject, signal } from '@angular/core';
import { EntryService } from '../../services/entry.service';

@Component({
  selector: 'app-wheel-svg',
  standalone: true,
  templateUrl: './wheel-svg.component.html',
  styleUrls: ['./wheel-svg.component.css'],
})
export class WheelSvgComponent {
  private angularVelocity = 0;
  private rafId: number | null = null;
  private lastFingerprint = '';

  readonly rStart = 12;
  readonly rEnd = 46;

  svc = inject(EntryService);
  angle = signal(0);
  spinning = signal(false);
  maxLabelsTarget = 120;
  Math = Math;

  entries = computed(() => this.svc.entries());
  n = computed(() => Math.max(1, this.entries().length));
  step = computed(() => (2 * Math.PI) / this.n());
  angleDeg = computed(() => (this.angle() * 180) / Math.PI);

  lineIndices = computed(() => {
    const n = this.n();
    const k = Math.max(1, Math.floor(n / 360));
    const arr: number[] = [];
    for (let i = 0; i < n; i += k) arr.push(i);
    return arr;
  });

  labelIndices = computed(() => {
    const n = this.n();
    const step = this.step();
    const minAngleForText = 0.012;
    let stride = n > this.maxLabelsTarget ? Math.ceil(n / this.maxLabelsTarget) : 1;
    if (step < minAngleForText) stride = Math.max(stride, Math.ceil(minAngleForText / step));

    const arr: number[] = [];
    for (let i = 0; i < n; i += stride) arr.push(i);
    return arr;
  });

  constructor() {
    effect(() => {
      const list = this.svc.entries();
      // * Fingerprint distinguishes load/clear from shuffle, Shuffles keep
      //   length but usually change the first element, so thay pass through
      //   without wiping the winner. A shuffle that happens to keep
      //   entries[0] will incorrectly preserve the winner - acceptable
      //   since the center label is informational, not authoritative.
      const fp = `${list.length}:${list[0] ?? ''}`;
      if (fp === this.lastFingerprint) return;

      this.lastFingerprint = fp;
      this.stop();
      this.angle.set(0);
      this.svc.lastWinner.set(null);
    });
  }

  fitLabel(text: string, maxChars: number) {
    if (text.length <= maxChars) return text;
    if (maxChars <= 1) return '…';
    return text.slice(0, Math.max(1, maxChars - 1)) + '…';
  }

  labelFontSize(stepRad: number): number {
    if (stepRad > 0.08) return 3.2;
    if (stepRad > 0.04) return 2.8;
    return 2.4;
  }

  labelMaxChars(stepRad: number): number {
    const fs = this.labelFontSize(stepRad);
    const radialSpace = Math.max(2, this.rEnd - this.rStart);
    const approxChars = Math.floor(radialSpace / (fs * 0.6));
    return Math.max(4, approxChars);
  }

  radialLabel(i: number): string {
    const list = this.entries();
    const txt = list[i] ?? '';
    const stepRad = this.step();
    return this.fitLabel(txt, this.labelMaxChars(stepRad));
  }

  spin() {
    if (this.spinning() || this.svc.entries().length === 0) return;
    const turns = 4 + Math.random() * 4;
    const spinDuration = 4 + Math.random() * 1;
    this.angularVelocity = (turns * 2 * Math.PI) / spinDuration;
    this.spinning.set(true);
    this.animate();
  }

  private animate() {
    const friction = 0.995;
    const start = performance.now();
    const tick = (now: number, last: number) => {
      // * Clamp dt so a background tab (RAF pauses) cannot jump the whell
      //   by senconds of friction in one step. 50ms caps the worst case at
      //   roughly three frames of motion on resume.
      const dt = Math.min((now - last) / 1000, 0.05);
      this.angle.update((a) => (a + this.angularVelocity * dt) % (2 * Math.PI));
      this.angularVelocity *= Math.pow(friction, dt * 60);

      if (this.angularVelocity < 0.2) {
        this.spinning.set(false);
        this.angularVelocity = 0;
        this.snapAndPickWinner();
        return;
      }
      this.rafId = requestAnimationFrame((n) => tick(n, now));
    };
    this.rafId = requestAnimationFrame((n) => tick(n, start));
  }

  private stop() {
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.spinning.set(false);
    this.angularVelocity = 0;
  }

  private snapAndPickWinner() {
    const list = this.entries();
    const n = list.length;
    if (n === 0) {
      // * Entries were cleared mid-spin. Bail instead of picking undefined.
      this.svc.lastWinner.set(null);
      return;
    }
    const step = (2 * Math.PI) / n;

    let pointerAngle = (-this.angle() - Math.PI / 2) % (2 * Math.PI);
    if (pointerAngle < 0) pointerAngle += 2 * Math.PI;

    const idx = Math.floor(pointerAngle / step) % n;
    const winner = list[idx] ?? null;
    this.svc.lastWinner.set(winner);

    const centerOfIdx = (idx + 0.5) * step;
    const targetWheelAngle = -(centerOfIdx + Math.PI / 2);
    this.angle.set(targetWheelAngle);

    // * Screen readers - the aria-live region lives in app.component.html
    //   and is the only non-visual cue that the wheel settled.
    const live = document.getElementById('winner-live');
    if (live && winner) live.textContent = `Winner: ${winner}`;
  }
}
