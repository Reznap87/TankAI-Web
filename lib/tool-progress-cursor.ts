export interface ToolEventCursorSource {
  jobVersion: number;
  id: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function encodeToolEventCursor(event: ToolEventCursorSource): string {
  return `${event.jobVersion}|${event.id}`;
}

export function parseToolEventCursor(
  value: string | null | undefined,
): { jobVersion: number; id: string } | null {
  if (!value || value.length > 60) return null;
  const separator = value.indexOf("|");
  if (separator < 1 || separator !== value.lastIndexOf("|")) return null;
  const rawJobVersion = value.slice(0, separator);
  const id = value.slice(separator + 1);
  const jobVersion = Number(rawJobVersion);
  if (
    !Number.isSafeInteger(jobVersion) ||
    jobVersion < 1 ||
    !UUID_PATTERN.test(id)
  ) {
    return null;
  }
  return { jobVersion, id };
}
