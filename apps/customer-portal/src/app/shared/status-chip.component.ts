import { Component, Input, computed, signal } from '@angular/core';

const OK_STATUSES = new Set(['ACTIVE', 'COMPLETED', 'APPROVED', 'SENT']);
const WARN_STATUSES = new Set(['PENDING', 'PENDING_ACTIVATION', 'FLAGGED', 'AUTHORIZED']);
const ERROR_STATUSES = new Set(['FAILED', 'REJECTED', 'BLOCKED', 'CLOSED', 'CANCELLED', 'DECLINED', 'FROZEN']);

/** A single, reused way to render any of the many status enums across the
 * platform (account/transfer/payment/card/kyc/notification) — same visual
 * language everywhere. */
@Component({
  selector: 'app-status-chip',
  standalone: true,
  template: `<span class="status-chip" [class]="cssClass()">{{ label() }}</span>`,
})
export class StatusChipComponent {
  private readonly statusSignal = signal('');

  @Input({ required: true })
  set status(value: string) {
    this.statusSignal.set(value ?? '');
  }

  readonly label = computed(() => this.statusSignal().replace(/_/g, ' '));

  readonly cssClass = computed(() => {
    const value = this.statusSignal();
    if (OK_STATUSES.has(value)) return 'status-ok';
    if (WARN_STATUSES.has(value)) return 'status-warn';
    if (ERROR_STATUSES.has(value)) return 'status-error';
    return 'status-neutral';
  });
}
