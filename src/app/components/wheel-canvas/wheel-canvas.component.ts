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

  constructor() {
    effect(() => {
      this.svc.entries();
    })
  }

  ngAfterViewInit() {
    this.resizeAndDraw();
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
    ctx.rotate(this.angle)

    const n = this.svc.entries().length || 2;
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
    ctx.moveTo(cx, cy - radius - 4);
    ctx.lineTo(cx - 12, cy - radius + 20);
    ctx.lineTo(cx + 12, cy - radius + 20);
    ctx.closePath();
    ctx.fill();
  }
}
