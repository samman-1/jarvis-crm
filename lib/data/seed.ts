import type {
  Attendance,
  AuditEntry,
  Client,
  Contact,
  Interaction,
  Message,
  Reminder,
  ScheduleDay,
  Task,
} from "@/lib/types";

/**
 * The starting dataset.
 *
 * Deliberately EMPTY. This system launched with invented demo companies so the
 * interface could be judged before the team had entered anything; that data has
 * been removed. Nothing here is fake — every client, visit and hour in the app
 * was put there by one of us.
 *
 * If you are looking for where to load the team's real clients: don't put them
 * here. Use the bulk import screen (Clients → Import), which parses a pasted
 * message and shows you a table to correct before saving.
 */

export interface SeedData {
  clients: Client[];
  contacts: Contact[];
  interactions: Interaction[];
  tasks: Task[];
  attendance: Attendance[];
  schedule: ScheduleDay[];
  audit: AuditEntry[];
  reminders: Reminder[];
  messages: Message[];
  /** Marks the shape of the stored payload so upgrades can be detected. */
  version: number;
}

/**
 * Bumped whenever the stored shape changes. A mismatch discards whatever is in
 * localStorage rather than half-migrating it.
 */
export const SEED_VERSION = 2;

export function buildSeed(): SeedData {
  return {
    clients: [],
    contacts: [],
    interactions: [],
    tasks: [],
    attendance: [],
    schedule: [],
    audit: [],
    reminders: [],
    messages: [],
    version: SEED_VERSION,
  };
}
