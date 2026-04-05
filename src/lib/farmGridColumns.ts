/**
 * Column count for the farm grid — matches Tailwind breakpoints previously on PrinterList:
 * grid-cols-1, min-[420px]:2, sm:2, md:3, lg:4, xl:6, 2xl:8
 */
export function getFarmGridColumns(viewportWidth: number): number {
  if (viewportWidth >= 1536) {
    return 8;
  }
  if (viewportWidth >= 1280) {
    return 6;
  }
  if (viewportWidth >= 1024) {
    return 4;
  }
  if (viewportWidth >= 768) {
    return 3;
  }
  if (viewportWidth >= 640) {
    return 2;
  }
  if (viewportWidth >= 420) {
    return 2;
  }
  return 1;
}
