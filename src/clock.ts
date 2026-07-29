/** A single clock seam for alert windows, quiet hours, and event timestamps. */
let clock: () => Date = () => new Date();

export function now(): Date {
  return clock();
}

/** Test-only hook. Production code always uses the system clock. */
export function setClockForTests(next?: () => Date): void {
  clock = next ?? (() => new Date());
}
