import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import { NotificationLog } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { StatusChipComponent } from '../../shared/status-chip.component';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, StatusChipComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  readonly loading = signal(true);
  readonly notifications = signal<NotificationLog[]>([]);

  ngOnInit(): void {
    const customerId = this.auth.customerId;
    if (!customerId) return;

    this.loading.set(true);
    this.notificationService
      .list(customerId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((notifications) =>
        this.notifications.set(notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
      );
  }

  channelIcon(channel: string): string {
    switch (channel.toUpperCase()) {
      case 'EMAIL':
        return 'mail';
      case 'SMS':
        return 'sms';
      case 'PUSH':
        return 'notifications';
      default:
        return 'info';
    }
  }
}
