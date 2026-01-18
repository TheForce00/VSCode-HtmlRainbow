/**
 * Creates a debounced version of a function that delays invoking the function
 * until after the specified wait time has elapsed since the last call.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function debounced(...args: Parameters<T>): void {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = undefined;
    }, wait);
  };
}

/**
 * Creates a debounced function that can be cancelled and updated with new wait time
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class DebouncedFunction<T extends (...args: any[]) => void> {
  private timeoutId: ReturnType<typeof setTimeout> | undefined;
  private wait: number;
  private func: T;

  constructor(func: T, wait: number) {
    this.func = func;
    this.wait = wait;
  }

  call(...args: Parameters<T>): void {
    this.cancel();
    this.timeoutId = setTimeout(() => {
      this.func(...args);
      this.timeoutId = undefined;
    }, this.wait);
  }

  cancel(): void {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }

  setWait(wait: number): void {
    this.wait = wait;
  }

  dispose(): void {
    this.cancel();
  }
}
