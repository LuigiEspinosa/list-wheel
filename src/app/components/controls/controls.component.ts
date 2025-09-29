import { Component, EventEmitter, inject, Output } from "@angular/core";
import { EntryService } from "../../services/entry.service";
import { DecimalPipe } from "@angular/common";

@Component({
  selector: 'app-controls',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './controls.component.html',
  styleUrls: ['./controls.component.css']
})

export class ControlsComponent {
  private svc = inject(EntryService);
  @Output() spin = new EventEmitter<void>();

  onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    file.text().then(txt => this.svc.loadFromText(txt));
    input.value = '';
  }

  onSpin() {
    if (this.svc.hasEntries()) {
      this.spin.emit();
    }
  }

  get count() {
    return this.svc.entries().length;
  }
}
