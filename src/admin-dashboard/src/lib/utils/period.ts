/**
 * Utility functions for handling validity periods for both:
 * - Study membership periods (tstzrange string: "[2024-01-01 00:00:00+00, 2025-12-31 23:59:59+00)")
 * - Device ownership periods (separate start_date and end_date timestamptz strings)
 *
 * These helpers provide a unified API so both Studies and Devices sidebars
 * can display validity consistently.
 */

export type PeriodStatus = 'active' | 'upcoming' | 'inactive' | 'none';

/**
 * Parses a tstzrange string like:
 *   "[2024-01-01 00:00:00+00, 2025-12-31 23:59:59+00)"
 *   or JSON-serialized arrays
 * Returns the start and end as ISO strings (without time component if possible).
 */
function parseTstzrange(period: string): { start: string; end: string } | null {
	try {
		const parsed = JSON.parse(period);
		if (Array.isArray(parsed) && parsed.length === 2) {
			return {
				start: String(parsed[0]).split(' ')[0],
				end: String(parsed[1]).split(' ')[0]
			};
		}
	} catch {
		// not JSON - fall through to regex
	}

	const match = period.match(/\[([^,]+),\s*([^)]+)\)/);
	if (match) {
		return {
			start: match[1].replace(/"/g, '').trim().split(' ')[0],
			end: match[2].replace(/"/g, '').trim().split(' ')[0]
		};
	}
	return null;
}

/**
 * Extracts a YYYY-MM-DD date from a timestamptz string.
 * Handles ISO strings like "2024-05-15T12:34:56+00:00" or "2024-05-15 12:34:56+00".
 */
function normalizeDateString(value: string | Date | null | undefined): string | null {
	if (value === null || value === undefined) return null;

	if (value instanceof Date) {
		if (isNaN(value.getTime())) return null;
		return value.toISOString().split('T')[0];
	}

	const str = String(value).trim();
	if (!str) return null;

	// Try direct YYYY-MM-DD prefix
	const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})/);
	if (isoMatch) return isoMatch[1];

	// Try Date constructor as fallback
	const d = new Date(str);
	if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];

	return null;
}

/**
 * Computes the start and end date as normalized YYYY-MM-DD strings from any
 * of the supported period representations:
 *   - tstzrange string (for study membership_period)
 *   - separate start and end strings/dates (for device ownership)
 *
 * Returns null if either side is missing/invalid.
 */
export function extractPeriod(
	startOrRange: string | Date | null | undefined,
	end?: string | Date | null
): { start: string; end: string } | null {
	// Case 1: tstzrange string passed as first arg
	if (typeof startOrRange === 'string' && end === undefined) {
		return parseTstzrange(startOrRange);
	}

	// Case 2: separate start and end
	const start = normalizeDateString(startOrRange);
	const endNorm = normalizeDateString(end);
	if (!start || !endNorm) return null;
	return { start, end: endNorm };
}

/**
 * Returns a stable reference "now" for status calculations.
 * Exposed for testability.
 */
function nowDate(): Date {
	return new Date();
}

/**
 * Determines whether a period is currently active, upcoming, inactive, or unset.
 *
 *   - 'none'      - no valid start or end
 *   - 'upcoming'  - both start and end are in the future (start > now)
 *   - 'inactive'  - both start and end are in the past (end < now). The
 *                   word "inactive" is used instead of "expired" because
 *                   having past dates is a normal lifecycle state for
 *                   research studies and device assignments, not a
 *                   failure or error.
 *   - 'active'    - now is between start and end (inclusive on start,
 *                   exclusive on end)
 */
export function getPeriodStatus(
	startOrRange: string | Date | null | undefined,
	end?: string | Date | null
): PeriodStatus {
	const period = extractPeriod(startOrRange, end);
	if (!period) return 'none';

	const now = nowDate();
	const start = new Date(period.start + 'T00:00:00');
	const endDate = new Date(period.end + 'T23:59:59.999');

	if (isNaN(start.getTime()) || isNaN(endDate.getTime())) return 'none';

	if (now < start) return 'upcoming';
	if (now > endDate) return 'inactive';
	return 'active';
}

/**
 * Returns a human-friendly display representation of the period.
 * Format: "Jan 1, 2024 → Dec 31, 2025" (using short month)
 * Returns null if the period cannot be parsed.
 */
export function formatPeriodDisplay(
	startOrRange: string | Date | null | undefined,
	end?: string | Date | null
): { start: string; end: string } | null {
	const period = extractPeriod(startOrRange, end);
	if (!period) return null;

	return {
		start: formatDate(period.start),
		end: formatDate(period.end)
	};
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(yyyyMmDd: string): string {
	const [y, m, d] = yyyyMmDd.split('-').map((v) => parseInt(v, 10));
	if (!y || !m || !d) return yyyyMmDd;
	return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// --- Backward-compatible API (kept for StudySection and any existing callers) ---

export function parseMembershipPeriod(period: string): { start: string; end: string } | null {
	return extractPeriod(period);
}

/**
 * @deprecated Use `formatPeriodDisplay` instead. Kept for backward compatibility
 * with `StudySection.svelte`.
 */
export function formatMembershipPeriodDisplay(
	period: string
): { start: string; end: string } | null {
	return formatPeriodDisplay(period);
}

export function buildMembershipPeriod(start: string, end: string): string | null {
	if (!start || !end) return null;
	return `[${start} 00:00:00, ${end} 23:59:59.99999999)`;
}
