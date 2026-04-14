import { Component, inject, ViewChild } from '@angular/core';
import { ControlsComponent } from './components/controls/controls.component';
import { WheelSvgComponent } from './components/wheel-svg/wheel-svg.component';
import { EntryEditorComponent } from './components/entry-editor/entry-editor.component';
import { EntryService } from './services/entry.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ControlsComponent, WheelSvgComponent, EntryEditorComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  @ViewChild(WheelSvgComponent) wheel!: WheelSvgComponent;

  readonly isEditing = inject(EntryService).isEditing;

  onSpinRequested() {
    this.wheel?.spin();
  }
}
