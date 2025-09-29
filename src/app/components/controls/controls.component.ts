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

  copied = false;

  onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    file.text().then(txt => this.svc.loadFromText(txt));
    input.value = '';
  }

  onShuffle() {
    this.svc.shuffle();
  }

  onSpin() {
    if (this.svc.hasEntries()) {
      this.spin.emit();
    }
  }

  onClear() {
    this.svc.clear();
  }

  async onCopyWinner() {
    const ok = await this.svc.copyWinner();
    this.copied = ok;
    setTimeout(() => (this.copied = false), 1500);
  }

  get count() {
    return this.svc.entries().length;
  }

  get winner() {
    return this.svc.lastWinner();
  }
}
