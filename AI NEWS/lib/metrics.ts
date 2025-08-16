type Cfg = {
  namespace?: string;
};
const cfg: Required<Cfg> = { namespace: 'ainews' };

const counters = new Map<string, number>();
const gauges = new Map<string, number>();

function key(name: string) {
  return `${cfg.namespace}_${name}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function inc(name: string, val = 1) {
  const k = key(name);
  counters.set(k, (counters.get(k) || 0) + val);
}

export function setGauge(name: string, val: number) {
  const k = key(name);
  gauges.set(k, val);
}

export function getPrometheusText(): string {
  const lines: string[] = [];
  // Counters
  for (const [k, v] of counters.entries()) {
    lines.push(`# TYPE ${k} counter`);
    lines.push(`${k} ${v}`);
  }
  // Gauges
  for (const [k, v] of gauges.entries()) {
    lines.push(`# TYPE ${k} gauge`);
    lines.push(`${k} ${v}`);
  }
  return lines.join('\n') + '\n';
}