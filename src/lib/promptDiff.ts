// Simple line-level diff (LCS based) used to compare AI prompt payloads.

export type DiffOp = "equal" | "added" | "removed";

export type DiffLine = {
  left?: string;
  right?: string;
  leftNumber?: number;
  rightNumber?: number;
  op: DiffOp;
};

export function toLines(value: unknown): string[] {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2);
  return (text ?? "").split("\n");
}

/** Longest-common-subsequence table based line diff, aligned into side-by-side rows. */
export function diffLines(before: string[], after: string[]): DiffLine[] {
  const n = before.length;
  const m = after.length;

  // Guard against pathological sizes (quadratic table).
  const MAX = 1500;
  if (n > MAX || m > MAX) {
    const rows: DiffLine[] = [];
    const len = Math.max(n, m);
    for (let i = 0; i < len; i++) {
      const l = before[i];
      const r = after[i];
      rows.push({
        left: l,
        right: r,
        leftNumber: l !== undefined ? i + 1 : undefined,
        rightNumber: r !== undefined ? i + 1 : undefined,
        op: l === r ? "equal" : l === undefined ? "added" : r === undefined ? "removed" : "added",
      });
    }
    return rows;
  }

  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const rows: DiffLine[] = [];
  let i = 0;
  let j = 0;
  const pending: DiffLine[] = [];

  const flushPending = () => {
    const removed = pending.filter((p) => p.op === "removed");
    const added = pending.filter((p) => p.op === "added");
    const len = Math.max(removed.length, added.length);
    for (let k = 0; k < len; k++) {
      const rm = removed[k];
      const ad = added[k];
      rows.push({
        left: rm?.left,
        right: ad?.right,
        leftNumber: rm?.leftNumber,
        rightNumber: ad?.rightNumber,
        op: rm && ad ? "added" : rm ? "removed" : "added",
      });
    }
    pending.length = 0;
  };

  while (i < n && j < m) {
    if (before[i] === after[j]) {
      flushPending();
      rows.push({ left: before[i], right: after[j], leftNumber: i + 1, rightNumber: j + 1, op: "equal" });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      pending.push({ left: before[i], leftNumber: i + 1, op: "removed" });
      i++;
    } else {
      pending.push({ right: after[j], rightNumber: j + 1, op: "added" });
      j++;
    }
  }
  while (i < n) pending.push({ left: before[i], leftNumber: ++i, op: "removed" });
  while (j < m) pending.push({ right: after[j], rightNumber: ++j, op: "added" });
  flushPending();

  return rows;
}

/** Collapse long runs of unchanged lines, keeping `context` lines around each change. */
export function collapseUnchanged(rows: DiffLine[], context = 3): (DiffLine | { op: "skip"; count: number })[] {
  const keep = new Set<number>();
  rows.forEach((r, idx) => {
    if (r.op === "equal") return;
    for (let k = idx - context; k <= idx + context; k++) if (k >= 0 && k < rows.length) keep.add(k);
  });

  const out: (DiffLine | { op: "skip"; count: number })[] = [];
  let skipped = 0;
  rows.forEach((r, idx) => {
    if (keep.has(idx)) {
      if (skipped > 0) {
        out.push({ op: "skip", count: skipped });
        skipped = 0;
      }
      out.push(r);
    } else {
      skipped++;
    }
  });
  if (skipped > 0) out.push({ op: "skip", count: skipped });
  return out;
}

export function countChanges(rows: DiffLine[]) {
  let added = 0;
  let removed = 0;
  for (const r of rows) {
    if (r.op === "equal") continue;
    if (r.right !== undefined) added++;
    if (r.left !== undefined) removed++;
  }
  return { added, removed };
}
