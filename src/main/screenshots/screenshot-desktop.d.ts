/**
 * Type declarations for screenshot-desktop (no official @types package available).
 * https://github.com/bencevans/screenshot-desktop
 */
declare module 'screenshot-desktop' {
  interface ScreenshotOptions {
    screen?: number | string;
    filename?: string;
    format?: 'png' | 'jpg';
  }

  function screenshot(options?: ScreenshotOptions): Promise<Buffer>;

  namespace screenshot {
    interface Display {
      id: number | string;
      name?: string;
      primary?: boolean;
    }
    function listDisplays(): Promise<Display[]>;
  }

  export = screenshot;
}
