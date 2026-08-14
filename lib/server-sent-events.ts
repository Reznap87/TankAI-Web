const encoder = new TextEncoder();

function cleanField(value: string): string {
  return value.replace(/[\r\n]/gu, "");
}

export function serverEvent(input: {
  event: string;
  data: unknown;
  id?: string;
  retry?: number;
}): Uint8Array {
  const lines: string[] = [];
  if (input.id) lines.push(`id: ${cleanField(input.id)}`);
  if (Number.isInteger(input.retry) && Number(input.retry) >= 1_000) {
    lines.push(`retry: ${Math.min(Number(input.retry), 30_000)}`);
  }
  lines.push(`event: ${cleanField(input.event)}`);
  const data = JSON.stringify(input.data).replace(/[\u2028\u2029]/gu, "");
  for (const line of data.split(/\r?\n/u)) lines.push(`data: ${line}`);
  return encoder.encode(`${lines.join("\n")}\n\n`);
}

export function serverComment(value: string): Uint8Array {
  return encoder.encode(`: ${cleanField(value)}\n\n`);
}
