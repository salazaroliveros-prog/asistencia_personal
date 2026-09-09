import { activeWorkers, filterByRange, latestByWorker, normalizeAttendance, summarizeAttendance } from './domain/attendance';
import type { AttendancePayload, Worker } from './domain/types';

declare global {
  interface Window {
    CpcDomain: {
      normalizeAttendance: typeof normalizeAttendance;
      filterByRange: typeof filterByRange;
      summarizeAttendance: typeof summarizeAttendance;
      latestByWorker: typeof latestByWorker;
      activeWorkers: typeof activeWorkers;
    };
    __cpcDomainReady?: boolean;
  }
}

window.CpcDomain = { normalizeAttendance, filterByRange, summarizeAttendance, latestByWorker, activeWorkers };
window.__cpcDomainReady = true;

export type { AttendancePayload, Worker };
