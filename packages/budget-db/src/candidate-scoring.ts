import type { PayeeMatchType } from './schema/budget-filter-selections';

/** One transaction as read from `ynab_transactions_enriched`. */
export type CandidateSourceRow = {
  payeeId: string | null;
  payeeName: string | null;
  /** `YYYY-MM-DD` */
  date: string;
  /** Signed units (outflows negative), not milliunits. */
  amountUnits: number;
  approved: boolean;
  categoryName: string | null;
};

/** The parts of a rule needed to tell whether a payee is already covered. */
export type CoverageRule = {
  enabled: boolean;
  payeeId: string | null;
  payeeMatchType: PayeeMatchType | null;
  payeePattern: string | null;
};

export type CandidateConfidence = 'high' | 'medium' | 'low';

export type Candidate = {
  /** Normalized payee key the transactions were grouped by. */
  key: string;
  /** Display name: the most common raw payee name in the group. */
  payeeName: string;
  /** Distinct raw payee names merged into this group. */
  payeeNames: string[];
  /** Set only when the group is a single YNAB payee. */
  payeeId: string | null;
  /** Longest common prefix of the names, for a `starts_with` rule. */
  commonPrefix: string;
  score: number;
  confidence: CandidateConfidence;
  dateScore: number;
  amountScore: number;
  volumeScore: number;
  transactionCount: number;
  unapprovedCount: number;
  lastDate: string;
  /** e.g. `~4th monthly` */
  schedule: string;
  anchorDay: number;
  amountMin: number;
  amountMax: number;
  amountMean: number;
  /** Coefficient of variation of absolute amounts. */
  amountCv: number;
  usualCategory: string | null;
  coveredByRule: boolean;
  reasons: string[];
};

export const MIN_TRANSACTIONS = 3;
export const DATE_TOLERANCE_DAYS = 3;
export const HIGH_CONFIDENCE_SCORE = 75;
export const MEDIUM_CONFIDENCE_SCORE = 50;

const AVG_MONTH_DAYS = 30.4;
const WEIGHTS = { date: 0.4, amount: 0.4, volume: 0.2 };
const CV_DECAY = 8;
const VOLUME_FULL_AT = 6;

/**
 * Reduces bank-style payee names to a key shared by logical duplicates, e.g.
 * `Royal Credit Uni CK-WTH PPD ID: 291880411` and
 * `Royal Credit Uni SAV-WTH PPD ID: 291880411` -> `royal credit uni`.
 */
export const normalizePayee = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\bppd\s*id:?\s*\w*/g, ' ')
    .replace(/\b(ck|sav|chk|sv)[-\s]?(wth|dep)\b/g, ' ')
    .replace(/#\s*\d+/g, ' ')
    .replace(/\b\d{3,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const round = (n: number, places = 3): number => {
  const f = 10 ** places;

  return Math.round(n * f) / f;
};

const mean = (xs: number[]): number =>
  xs.reduce((a, b) => a + b, 0) / xs.length;

const stddev = (xs: number[]): number => {
  const m = mean(xs);

  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

const circularDayDistance = (a: number, b: number): number => {
  const d = Math.abs(a - b);

  return Math.min(d, AVG_MONTH_DAYS - d);
};

const ordinal = (n: number): string => {
  const mod100 = n % 100;

  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;

  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

const parseDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);

  return { year: y, month: m, day: d, monthIndex: y * 12 + (m - 1) };
};

/** Day of month that minimizes total circular distance to all `days`. */
export const anchorDay = (days: number[]): number => {
  let best = 1;
  let bestCost = Infinity;

  for (let candidate = 1; candidate <= 31; candidate++) {
    const cost = days.reduce(
      (sum, d) => sum + circularDayDistance(candidate, d),
      0,
    );

    if (cost < bestCost) {
      bestCost = cost;
      best = candidate;
    }
  }

  return best;
};

/**
 * 0-1: how regularly the group lands on the same day of the month (within a
 * few days, so weekend slides are fine), at roughly one per month.
 */
export const scoreDates = (
  dates: string[],
): { score: number; anchor: number; withinShare: number; months: number } => {
  const parsed = dates.map(parseDate);
  const days = parsed.map((p) => p.day);
  const anchor = anchorDay(days);
  const within = days.filter(
    (d) => circularDayDistance(anchor, d) <= DATE_TOLERANCE_DAYS,
  ).length;
  const monthIndexes = parsed.map((p) => p.monthIndex);
  const distinctMonths = new Set(monthIndexes).size;
  const span = Math.max(...monthIndexes) - Math.min(...monthIndexes) + 1;
  const withinShare = within / days.length;
  // Misses when months are skipped, and when several land in one month.
  const cadence = (distinctMonths / span) * (distinctMonths / days.length);

  return {
    score: withinShare * cadence,
    anchor,
    withinShare,
    months: distinctMonths,
  };
};

/**
 * 0-1 from the coefficient of variation of absolute amounts:
 * identical -> 1, a few cents of drift -> ~0.99, 40/60/90 -> ~0.1.
 */
export const scoreAmounts = (
  amounts: number[],
): { score: number; cv: number; mean: number } => {
  const abs = amounts.map(Math.abs);
  const m = mean(abs);
  const cv = m === 0 ? 0 : stddev(abs) / m;

  return { score: Math.exp(-CV_DECAY * cv), cv, mean: m };
};

export const confidenceFor = (score: number): CandidateConfidence =>
  score >= HIGH_CONFIDENCE_SCORE
    ? 'high'
    : score >= MEDIUM_CONFIDENCE_SCORE
      ? 'medium'
      : 'low';

const commonPrefix = (names: string[]): string => {
  let prefix = names[0] ?? '';

  for (const name of names.slice(1)) {
    let i = 0;

    while (
      i < prefix.length &&
      i < name.length &&
      prefix[i].toLowerCase() === name[i].toLowerCase()
    ) {
      i++;
    }
    prefix = prefix.slice(0, i);
  }

  return prefix.trim();
};

const mostCommon = (values: string[]): string | null => {
  const counts = new Map<string, number>();

  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  let best: string | null = null;
  let bestCount = 0;

  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }

  return best;
};

const money = (n: number): string => n.toFixed(2);

const ruleCoversPayee = (
  rule: CoverageRule,
  payeeIds: Set<string>,
  names: string[],
): boolean => {
  if (!rule.enabled) return false;

  if (rule.payeeId != null) return payeeIds.has(rule.payeeId);

  if (rule.payeePattern != null) {
    const pattern = rule.payeePattern.toLowerCase();
    const type = rule.payeeMatchType ?? 'equals';

    return names.some((n) => {
      const name = n.toLowerCase();

      switch (type) {
        case 'starts_with':
          return name.startsWith(pattern);
        case 'contains':
          return name.includes(pattern);
        case 'ends_with':
          return name.endsWith(pattern);
        default:
          return name === pattern;
      }
    });
  }

  return false;
};

/**
 * Groups transactions by logical payee and scores each group on how well it
 * would work as a filter rule. Sorted best first.
 */
export const scoreCandidates = (
  rows: CandidateSourceRow[],
  rules: CoverageRule[] = [],
): Candidate[] => {
  const groups = new Map<string, CandidateSourceRow[]>();

  for (const row of rows) {
    if (!row.payeeName) continue;

    const key = normalizePayee(row.payeeName);

    if (!key) continue;

    const group = groups.get(key) ?? [];

    group.push(row);
    groups.set(key, group);
  }

  const candidates: Candidate[] = [];

  for (const [key, group] of groups) {
    if (group.length < MIN_TRANSACTIONS) continue;

    const dates = scoreDates(group.map((r) => r.date));
    const amounts = scoreAmounts(group.map((r) => r.amountUnits));
    const volumeScore = Math.min(1, group.length / VOLUME_FULL_AT);
    const score =
      100 *
      (WEIGHTS.date * dates.score +
        WEIGHTS.amount * amounts.score +
        WEIGHTS.volume * volumeScore);

    const names = group.map((r) => r.payeeName as string);
    const distinctNames = [...new Set(names)];
    const payeeIds = new Set(
      group.map((r) => r.payeeId).filter((id): id is string => id != null),
    );
    const signed = group.map((r) => r.amountUnits);
    const categories = group
      .map((r) => r.categoryName)
      .filter((c): c is string => c != null);

    const reasons: string[] = [];
    const sameAmount = Math.max(...signed) === Math.min(...signed);

    reasons.push(
      `${dates.months} month${dates.months === 1 ? '' : 's'}, ${Math.round(dates.withinShare * 100)}% within ±${DATE_TOLERANCE_DAYS} days of the ${ordinal(dates.anchor)}`,
    );
    reasons.push(
      sameAmount
        ? `amount identical (${money(signed[0])})`
        : `amount varies ${Math.round(amounts.cv * 100)}% (${money(Math.min(...signed))} to ${money(Math.max(...signed))})`,
    );
    reasons.push(`${group.length} transactions`);

    if (distinctNames.length > 1) {
      reasons.push(`${distinctNames.length} payee spellings merged`);
    }

    candidates.push({
      key,
      payeeName: mostCommon(names) ?? names[0],
      payeeNames: distinctNames,
      payeeId:
        payeeIds.size === 1 && distinctNames.length === 1
          ? [...payeeIds][0]
          : null,
      commonPrefix: commonPrefix(distinctNames),
      score: round(score, 1),
      confidence: confidenceFor(score),
      dateScore: round(dates.score),
      amountScore: round(amounts.score),
      volumeScore: round(volumeScore),
      transactionCount: group.length,
      unapprovedCount: group.filter((r) => !r.approved).length,
      lastDate: group.map((r) => r.date).sort()[group.length - 1],
      schedule: `~${ordinal(dates.anchor)} monthly`,
      anchorDay: dates.anchor,
      amountMin: Math.min(...signed),
      amountMax: Math.max(...signed),
      amountMean: round(amounts.mean, 2),
      amountCv: round(amounts.cv),
      usualCategory: mostCommon(categories),
      coveredByRule: rules.some((r) =>
        ruleCoversPayee(r, payeeIds, distinctNames),
      ),
      reasons,
    });
  }

  return candidates.sort(
    (a, b) => b.score - a.score || b.transactionCount - a.transactionCount,
  );
};
