import { Component, ViewChild } from "@angular/core";
import { ControlsComponent } from "./components/controls/controls.component";
import { WheelSvgComponent } from "./components/wheel-svg/wheel-svg.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ControlsComponent, WheelSvgComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})

export class AppComponent {
  @ViewChild(WheelSvgComponent) wheel!: WheelSvgComponent;

  onSpinRequested() {
    this.wheel?.spin();
  }
}
