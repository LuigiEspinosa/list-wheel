import { Component, effect, ElementRef, inject, ViewChild } from "@angular/core";
import { EntryService } from "../../services/entry.service";

@Component({
  selector: 'app-wheel-canvas',
  standalone: true,
  templateUrl: './wheel-canvas.component.html',
  styleUrls: ['./wheel-canvas.component.css']
})

export class WheelCanvasComponent {
  private svc = inject(EntryService);
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private angle = 0;
  private angularVelocity = 0;
  private rafId: number | null = null;
  private spinning = false;
  winner: string | null = null;

  private cleanup?: () => void;

  constructor() {
    effect(() => {
      this.svc.entries();
      this.angle = 0;
      queueMicrotask(() => this.draw());
    });

    const onResize = () => this.resizeAndDraw();
    window.addEventListener('resize', onResize);
    this.cleanup = () => window.removeEventListener('resize', onResize)
  }

  ngAfterViewInit() {
    this.resizeAndDraw();
  }

  ngOnDestroy() {
    this.cleanup?.();
  }

  spin() {
    if (this.spinning || this.svc.entries().length === 0) return;
    const turns = 4 + Math.random() * 4;
    const spinDuration = 4 + Math.random() * 1.2;
    this.angularVelocity = (turns * 2 * Math.PI) / spinDuration;
    this.spinning = true;
    this.winner = null;
    this.animate();
  }

  private animate() {
    const friction = 0.995;
    const start = performance.now();

    const tick = (now: number, last: number) => {
      const dt = (now - last) / 1000;
      this.angle = (this.angle + this.angularVelocity * dt) % (2 * Math.PI);
      this.angularVelocity *= Math.pow(friction, dt * 60);
      this.draw();

      if (this.angularVelocity < 0.2) {
        this.spinning = false;
        this.angularVelocity = 0;
        this.snapAndPickWinner();
        return;
      }

      this.rafId = requestAnimationFrame((n) => tick(n, now));
    }

    this.rafId = requestAnimationFrame((n) => tick(n, start));
  }

  private resizeAndDraw() {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const size = Math.min(parent?.clientWidth || 960, parent?.clientHeight || 480)

    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  private draw() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const cssW = canvas.width / (window.devicePixelRatio || 1);
    const cssH = canvas.height / (window.devicePixelRatio || 1);
    const cx = cssW / 2;
    const cy = cssH / 2;
    const radius = Math.min(cssW, cssH) * 0.48;

    ctx.clearRect(0, 0, cssW, cssH);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.angle);

    const n = this.svc.entries().length || 1;
    const step = (2 * Math.PI) / n;

    const k = Math.max(1, Math.floor(n / 360));
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#e5e5e5';
    ctx.beginPath();

    for (let i = 0; i < n; i += k) {
      const a = i * step;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }

    ctx.stroke();

    const bands = Math.min(12, Math.max(6, Math.floor(Math.log2(n))));
    for (let b = 0; b < bands; b++) {
      const startA = (b / bands) * 2 * Math.PI;
      const endA = ((b + 1) / bands) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startA, endA);
      ctx.closePath();
      ctx.fillStyle = b % 2 === 0 ? '#fafafa' : '#f4f4f4';
      ctx.fill();
    }

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.restore();

    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius + 18);
    ctx.lineTo(cx - 12, cy - radius - 10);
    ctx.lineTo(cx + 12, cy - radius - 10);
    ctx.closePath();
    ctx.fill();


    if (this.winner) {
      ctx.fillStyle = '#111';
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      this.fitText(ctx, this.winner, cx, cy, radius * 1.4);
    }
  }

  private fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
    let size = 22;
    ctx.font = `700 ${size}px system-ui, sans-serif`;

    while (ctx.measureText(text).width > maxWidth && size > 10) {
      size -= 1;
      ctx.font = `700 ${size}px system-ui sans-serif`;
    }

    ctx.fillText(text, x, y);
  }

  private snapAndPickWinner() {
    const n = this.svc.entries().length;
    if (n === 0) return;

    const step = (2 * Math.PI) / n;

    let pointerAngle = (-this.angle - Math.PI / 2) % (2 * Math.PI);
    if (pointerAngle < 0) pointerAngle += 2 * Math.PI;

    const idx = Math.floor(pointerAngle / step) % n;
    this.winner = this.svc.entries()[idx] ?? null;

    const centerOfIdx = (idx + 0.5) * step;
    const targetWheelAngle = -(centerOfIdx + Math.PI / 2);
    this.angle = targetWheelAngle;
    this.draw();

    // Test for Screen Readers
    const live = document.getElementById('winner-live');
    if (live) live.textContent = `Winner: ${this.winner}`;
  }
}
