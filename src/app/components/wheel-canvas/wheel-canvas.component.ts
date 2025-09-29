import { Component, ElementRef, inject, ViewChild } from "@angular/core";
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
}
