import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize, forkJoin } from 'rxjs';
import { ActivitySummary, TransactionRecord } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { ReportingService } from '../../core/services/reporting.service';
import { formatMoney } from '../../shared/money.util';
import { StatusChipComponent } from '../../shared/status-chip.component';

@Component({
  selector: 'app-statement',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, StatusChipComponent],
  templateUrl: './statement.component.html',
  styleUrl: './statement.component.scss',
})
export class StatementComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly reportingService = inject(ReportingService);

  readonly loading = signal(true);
  readonly records = signal<TransactionRecord[]>([]);
  readonly activity = signal<ActivitySummary | null>(null);

  readonly formatMoney = formatMoney;

  ngOnInit(): void {
    const customerId = this.auth.customerId;
    if (!customerId) return;

    this.loading.set(true);
    forkJoin({
      statement: this.reportingService.statement(customerId),
      activity: this.reportingService.activity(customerId),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ statement, activity }) => {
        this.records.set(statement);
        this.activity.set(activity);
      });
  }
}
