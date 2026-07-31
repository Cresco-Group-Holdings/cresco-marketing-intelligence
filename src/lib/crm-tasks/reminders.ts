import {
  DEFAULT_OVERDUE_GRACE_HOURS,
  DEFAULT_REMINDER_MINUTES_BEFORE,
  MIN_REMINDER_INTERVAL_MINUTES,
} from "@/lib/crm-tasks/constants";

export type ReminderInput = {
  dueDate: Date;
  dueTime?: string | null;
  timezone?: string | null;
  minutesBefore?: number;
  includeOverdue?: boolean;
};

export type ScheduledReminder = {
  remindAt: Date;
  reminderType: "BEFORE_DUE" | "OVERDUE" | "ESCALATION";
  minutesBefore?: number;
  timezone?: string;
};

function combineDueDateTime(dueDate: Date, dueTime?: string | null): Date {
  const combined = new Date(dueDate);
  if (!dueTime) return combined;
  const [hours, minutes] = dueTime.split(":").map(Number);
  if (Number.isFinite(hours) && Number.isFinite(minutes)) {
    combined.setHours(hours, minutes, 0, 0);
  }
  return combined;
}

export function buildTaskReminders(input: ReminderInput): ScheduledReminder[] {
  const dueAt = combineDueDateTime(input.dueDate, input.dueTime);
  const minutesBefore = Math.max(input.minutesBefore ?? DEFAULT_REMINDER_MINUTES_BEFORE, MIN_REMINDER_INTERVAL_MINUTES);
  const beforeDue = new Date(dueAt.getTime() - minutesBefore * 60_000);
  const reminders: ScheduledReminder[] = [
    {
      remindAt: beforeDue,
      reminderType: "BEFORE_DUE",
      minutesBefore,
      timezone: input.timezone ?? undefined,
    },
  ];

  if (input.includeOverdue !== false) {
    const overdueAt = new Date(dueAt.getTime() + DEFAULT_OVERDUE_GRACE_HOURS * 3_600_000);
    const escalationAt = new Date(overdueAt.getTime() + MIN_REMINDER_INTERVAL_MINUTES * 60_000);
    reminders.push({
      remindAt: overdueAt,
      reminderType: "OVERDUE",
      timezone: input.timezone ?? undefined,
    });
    reminders.push({
      remindAt: escalationAt,
      reminderType: "ESCALATION",
      timezone: input.timezone ?? undefined,
    });
  }

  return reminders.filter((r) => r.remindAt > new Date());
}

export function shouldNotifyReminder(reminder: { notifiedAt: Date | null; remindAt: Date }, now = new Date()): boolean {
  if (reminder.notifiedAt) return false;
  return reminder.remindAt <= now;
}
