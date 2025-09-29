import { Component, ViewChild } from "@angular/core";
import { ControlsComponent } from "./components/controls/controls.component";
import { WheelCanvasComponent } from "./components/wheel-canvas/wheel-canvas.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ControlsComponent, WheelCanvasComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})

export class AppComponent {
  @ViewChild(WheelCanvasComponent) wheel!: WheelCanvasComponent;

  onSpinRequested() {
    this.wheel?.spin();
  }
}
