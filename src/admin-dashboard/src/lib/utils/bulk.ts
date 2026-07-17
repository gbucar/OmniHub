/**
 * Bulk upload/download helpers.
 *
 * Responsibilities:
 *   - Auto-detect CSV column mapping from header aliases.
 *   - Parse device columns (`device_1_name`, `device_1_start_date`, …) into
 *     a flat `Device[]` array on each parsed row.
 *   - Validate each parsed row against the current study/sensor catalog
 *     and return one of three buckets: `valid` | `problematic` | `rejected`.
 *   - Build a human-readable list of actions that will be performed for a
 *     valid row (added to study, devices assigned, …).
 *
 * No state, no network calls. Pure functions; the wizard component drives
 * the flow and decides which helpers to invoke.
 */

import type { Study, Sensor } from '$lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Device = {
	name: string;
	start: string;
	end: string;
};

/**
 * A row parsed from the CSV, with all fields resolved to strings.
 * Empty cells become `''`. Optional fields (e.g. `name`, `age`) are also
 * `''` when missing — callers must treat them as "not provided".
 */
export type ParsedRow = {
	username: string;
	password: string;
	name: string;
	age: string;
	sex: string;
	type: string;
	sys_created_at: string;
	study_name: string;
	study_start_date: string;
	study_end_date: string;
	devices: Device[];
};

export type ValidationStatus = 'valid' | 'rejected' | 'problematic';

export type ValidationResult = {
	status: ValidationStatus;
	row: ParsedRow;
	/**
	 * Index of this row in the source CSV (0-based, header excluded).
	 * Used by the wizard to track dismissals without depending on object
	 * identity (parsed rows are reconstructed on every render).
	 */
	index: number;
	/** A short, human-readable explanation shown in the preview table. */
	reason?: string;
	/** For valid rows: a bullet list of actions the import will perform. */
	actions?: string[];
};

/** Max number of device_N_* column groups we accept in a CSV. */
export const MAX_DEVICES = 5;

/** A fixed ordering of the system fields the wizard exposes in step 2. */
export const SYSTEM_FIELDS: Array<{ key: keyof Omit<ParsedRow, 'devices'>; required: boolean }> = [
	{ key: 'username', required: true },
	{ key: 'password', required: false },
	{ key: 'name', required: false },
	{ key: 'age', required: false },
	{ key: 'sex', required: false },
	{ key: 'type', required: false },
	{ key: 'study_name', required: false },
	{ key: 'study_start_date', required: false },
	{ key: 'study_end_date', required: false }
];

// ---------------------------------------------------------------------------
// Alias-based auto-detection
// ---------------------------------------------------------------------------

/**
 * Lower-cased aliases for each system field. We compare aliases against
 * lower-cased, trimmed CSV headers after stripping whitespace.
 */
const ALIASES: Record<string, string[]> = {
	username: ['username', 'user', 'uporabnik', 'uporabnisko_ime', 'login', 'email'],
	password: ['password', 'pass', 'geslo', 'pwd'],
	name: ['name', 'ime', 'full_name', 'fullname', 'full name'],
	age: ['age', 'starost', 'years'],
	sex: ['sex', 'spol', 'gender'],
	type: ['type', 'tip', 'role', 'category'],
	study_name: ['study', 'study_name', 'raziskava', 'study name'],
	study_start_date: [
		'study_start',
		'study_start_date',
		'study start',
		'study start date',
		'start',
		'start_date',
		'start date',
		'zacetek_studije',
		'začetek_študije',
		'zacetek',
		'začetek'
	],
	study_end_date: [
		'study_end',
		'study_end_date',
		'study end',
		'study end date',
		'end',
		'end_date',
		'end date',
		'konec_studije',
		'konec'
	]
};

/** Empty mapping (no field assigned) — value used by the wizard for "skip". */
export const NO_MAPPING = '';

/**
 * Given the CSV headers, propose a mapping `{ systemField -> csvHeader }`.
 *
 * Each CSV header is consumed by at most one system field (first match wins).
 * Unmatched headers are left unassigned (`NO_MAPPING`).
 */
export function autoDetectMapping(headers: string[]): Record<string, string> {
	const mapping: Record<string, string> = {};
	for (const field of Object.keys(ALIASES)) mapping[field] = NO_MAPPING;

	const used = new Set<string>();
	for (const field of Object.keys(ALIASES)) {
		for (const raw of headers) {
			const h = raw.trim().toLowerCase();
			if (used.has(h)) continue;
			if (ALIASES[field].includes(h)) {
				mapping[field] = raw;
				used.add(h);
				break;
			}
		}
	}

	// Device columns have a structured name (`device_1_name` etc.) and are
	// picked up by a separate pass below — not via aliases. We accept the
	// english stem (`device_1`, `device_1_start`, `device_1_end`) and
	// the slovenian equivalent (`naprava_1`, `naprava_1_zacetek`,
	// `naprava_1_konec`) so a hand-rolled sheet in either language maps
	// cleanly.
	for (let n = 1; n <= MAX_DEVICES; n++) {
		const nameKey = `device_${n}_name`;
		const startKey = `device_${n}_start_date`;
		const endKey = `device_${n}_end_date`;
		mapping[nameKey] = pickHeader(headers, [nameKey, `device_${n}`, `sensor_${n}`, `naprava_${n}`]);
		if (mapping[nameKey] !== NO_MAPPING) used.add(mapping[nameKey].trim().toLowerCase());
		mapping[startKey] = pickHeader(headers, [
			startKey,
			`device_${n}_start`,
			`naprava_${n}_zacetek`,
			`naprava_${n}_začetek`,
			`naprava_${n}_start`
		]);
		if (mapping[startKey] !== NO_MAPPING) used.add(mapping[startKey].trim().toLowerCase());
		mapping[endKey] = pickHeader(headers, [
			endKey,
			`device_${n}_end`,
			`naprava_${n}_konec`,
			`naprava_${n}_end`
		]);
		if (mapping[endKey] !== NO_MAPPING) used.add(mapping[endKey].trim().toLowerCase());
	}

	return mapping;
}

function pickHeader(headers: string[], candidates: string[]): string {
	for (const raw of headers) {
		const h = raw.trim().toLowerCase();
		if (candidates.includes(h)) return raw;
	}
	return NO_MAPPING;
}

// ---------------------------------------------------------------------------
// Row construction from raw CSV cells
// ---------------------------------------------------------------------------

/**
 * A raw CSV row augmented with a lookup table from header name → column
 * index. Built by `attachHeaderIndex` so `parseRowFromMapping` can
 * resolve cells by header name in O(1).
 */
export type IndexedRow = string[] & { __headerIndex?: Record<string, number> };

/**
 * Convert a raw CSV row (array of cells) into a `ParsedRow` using the
 * mapping from step 2. Unmapped system fields default to `''`.
 */
export function parseRowFromMapping(
	rawRow: IndexedRow,
	mapping: Record<string, string>
): ParsedRow {
	const cellFor = (key: string): string => {
		const header = mapping[key];
		if (header === NO_MAPPING || !header) return '';
		const idx = rawRow.__headerIndex?.[header];
		if (idx === undefined) return '';
		return rawRow[idx] ?? '';
	};

	const devices: Device[] = [];
	for (let n = 1; n <= MAX_DEVICES; n++) {
		const name = cellFor(`device_${n}_name`);
		if (!name) {
			// Stop at the first empty device slot — preserves order when only
			// the first N slots are used.
			break;
		}
		devices.push({
			name,
			start: cellFor(`device_${n}_start_date`),
			end: cellFor(`device_${n}_end_date`)
		});
	}

	return {
		username: cellFor('username'),
		password: cellFor('password'),
		name: cellFor('name'),
		age: cellFor('age'),
		sex: cellFor('sex'),
		type: cellFor('type'),
		// `sys_created_at` is no longer exposed in the wizard (step 2 has
		// no mapping row for it). To keep the import flow self-contained
		// and ensure downstream consumers always see a value, fall back
		// to today when nothing is set.
		sys_created_at: cellFor('sys_created_at') || new Date().toISOString().slice(0, 10),
		study_name: cellFor('study_name'),
		study_start_date: cellFor('study_start_date'),
		study_end_date: cellFor('study_end_date'),
		devices
	};
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Lightweight date validation: must look like `YYYY-MM-DD` AND parse
 * to a real calendar date (rejects e.g. `2024-13-40`).
 */
export function isValidDate(dateStr: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
	const d = new Date(dateStr + 'T00:00:00Z');
	if (Number.isNaN(d.getTime())) return false;
	// Re-check the round-trip — `new Date('2024-02-30')` rolls over to Mar 1.
	return d.toISOString().slice(0, 10) === dateStr;
}

/**
 * Validate a single parsed row.
 *
 *   - `rejected`: hard error — row will not be imported, ever.
 *   - `problematic`: soft issue — e.g. a sensor name not in the DB or no
 *     study assignment resolvable. Row will not be imported but the
 *     admin can fix it and retry.
 *   - `valid`: row will be imported. `actions` describes the side effects.
 */
export function validateRow(
	row: ParsedRow,
	sensors: Sensor[],
	studies: Study[],
	selectedStudy: Study | null
): ValidationResult {
	// 1. Required: username.
	if (!row.username || row.username.trim() === '') {
		return { status: 'rejected', row, index: -1, reason: 'Missing username' };
	}

	// 2. Study dates — if either is present, both must be valid and in order.
	if (row.study_start_date && !isValidDate(row.study_start_date)) {
		return {
			status: 'rejected',
			row,
			index: -1,
			reason: `Invalid study_start_date: "${row.study_start_date}"`
		};
	}
	if (row.study_end_date && !isValidDate(row.study_end_date)) {
		return {
			status: 'rejected',
			row,
			index: -1,
			reason: `Invalid study_end_date: "${row.study_end_date}"`
		};
	}
	if (row.study_start_date && row.study_end_date && row.study_end_date < row.study_start_date) {
		return {
			status: 'rejected',
			row,
			index: -1,
			reason: 'study_end_date is before study_start_date'
		};
	}

	// 3. Device rows.
	for (const device of row.devices) {
		if (device.start && !isValidDate(device.start)) {
			return {
				status: 'rejected',
				row,
				index: -1,
				reason: `Invalid start_date for device "${device.name}": "${device.start}"`
			};
		}
		if (device.end && !isValidDate(device.end)) {
			return {
				status: 'rejected',
				row,
				index: -1,
				reason: `Invalid end_date for device "${device.name}": "${device.end}"`
			};
		}
		if (device.start && device.end && device.end < device.start) {
			return {
				status: 'rejected',
				row,
				index: -1,
				reason: `Device "${device.name}": end before start`
			};
		}
		// Sensor not in DB → problematic. We surface this as the FIRST
		// device issue so the admin sees a clear single reason.
		if (!sensors.find((s) => s.name === device.name)) {
			return {
				status: 'problematic',
				row,
				index: -1,
				reason: `Device "${device.name}" not found in database`
			};
		}
	}

	// 4. Study resolution.
	if (row.study_name && !studies.find((s) => s.name === row.study_name)) {
		return {
			status: 'problematic',
			row,
			index: -1,
			reason: `Study "${row.study_name}" not found in database`
		};
	}
	if (!row.study_name && !selectedStudy) {
		return {
			status: 'problematic',
			row,
			index: -1,
			reason: 'No study_name in CSV and no default study selected in step 3'
		};
	}

	// 5. Age — if present, must be a number in a reasonable range.
	if (row.age) {
		const age = parseInt(row.age, 10);
		if (Number.isNaN(age) || age < 0 || age > 150) {
			return {
				status: 'rejected',
				row,
				index: -1,
				reason: `Invalid age: "${row.age}"`
			};
		}
	}

	return {
		status: 'valid',
		row,
		index: -1,
		actions: buildActionsList(row, sensors, studies, selectedStudy)
	};
}

function buildActionsList(
	row: ParsedRow,
	sensors: Sensor[],
	studies: Study[],
	selectedStudy: Study | null
): string[] {
	const actions: string[] = [];
	const study = row.study_name
		? (studies.find((s) => s.name === row.study_name) ?? null)
		: selectedStudy;
	if (study) actions.push(`+ ${study.name}`);
	for (const device of row.devices) {
		const sensor = sensors.find((s) => s.name === device.name);
		if (sensor) actions.push(`+ ${sensor.name}`);
	}
	return actions;
}

/**
 * Validate a batch of rows in one go. Returns the three buckets the
 * preview table renders. Order within each bucket matches the input.
 *
 * Each `ValidationResult` is stamped with the source index of its row
 * so the wizard can dismiss rows by index without relying on object
 * identity (parsed rows are reconstructed on every re-render).
 */
export function validateAllRows(
	rows: ParsedRow[],
	sensors: Sensor[],
	studies: Study[],
	selectedStudy: Study | null
): { valid: ValidationResult[]; problematic: ValidationResult[]; rejected: ValidationResult[] } {
	const valid: ValidationResult[] = [];
	const problematic: ValidationResult[] = [];
	const rejected: ValidationResult[] = [];
	rows.forEach((row, index) => {
		const result = validateRow(row, sensors, studies, selectedStudy);
		result.index = index;
		if (result.status === 'valid') valid.push(result);
		else if (result.status === 'problematic') problematic.push(result);
		else rejected.push(result);
	});
	return { valid, problematic, rejected };
}

// ---------------------------------------------------------------------------
// CSV header index helper
// ---------------------------------------------------------------------------

/**
 * Augment a raw row array with a `__headerIndex` lookup so
 * `parseRowFromMapping` can find cells by header name in O(1). Created
 * once per CSV in the wizard, then attached to every row.
 *
 * Throws if any two headers collide after trimming — silently accepting
 * duplicates would let the later column's data overwrite the earlier one
 * and the user would have no way to know. The wizard surfaces the error
 * in step 1 before the user can map anything.
 */
export function indexHeaders(headers: string[]): Record<string, number> {
	const out: Record<string, number> = {};
	const seen = new Set<string>();
	headers.forEach((h, i) => {
		const key = h.trim();
		if (key === '') {
			throw new Error(`Header at column ${i + 1} is empty`);
		}
		if (seen.has(key)) {
			throw new Error(`Duplicate header: "${key}" appears more than once`);
		}
		seen.add(key);
		out[key] = i;
	});
	return out;
}

/**
 * Type augmentation: a raw row is just a `string[]`, but
 * `parseRowFromMapping` treats it as an `IndexedRow` (`string[] & { __headerIndex }`).
 * This helper performs the cast cleanly.
 */
export function attachHeaderIndex(
	rows: string[][],
	headerIndex: Record<string, number>
): IndexedRow[] {
	return rows.map((r) => Object.assign([...r], { __headerIndex: headerIndex }));
}

// ---------------------------------------------------------------------------
// Postgres range string parser (for download)
// ---------------------------------------------------------------------------

/**
 * Postgres returns daterange/tstzrange as strings like:
 *   `[2024-01-01 00:00:00, 2024-12-31 23:59:59.99999999)`
 *   `[2024-01-01,2024-12-31)`
 *   `(2024-01-01,)` (open upper bound)
 *   `(,2024-12-31)` (open lower bound)
 *   `empty` (the literal string for the empty range)
 *   `` (NULL)
 *   `["2024-01-01 00:00:00+00","2024-12-31 23:59:59.99999999+00")`
 *
 * We extract the start/end dates (YYYY-MM-DD) for the download CSV.
 * Missing bounds (open ranges) come back as empty strings.
 */
export function parseRangeBounds(rangeStr: string | null | undefined): {
	start: string;
	end: string;
} {
	if (!rangeStr || rangeStr.trim() === '') return { start: '', end: '' };

	const trimmed = rangeStr.trim();
	if (trimmed === 'empty') return { start: '', end: '' };

	// The format is: `[(|<`, optional date, `,`, optional date, `)|>]`.
	// Each date is optional — Postgres uses `(,)` for an empty range, and
	// `(2024-01-01,)` for an open upper bound. We use `[^",)\]]*` to
	// capture an empty string between the leading bracket and the comma.
	const m = trimmed.match(/^[\[\(]\s*"?([^",)\]]*)"?\s*,\s*"?([^",)\]]*)"?\s*[\)\]]$/);
	if (!m) return { start: '', end: '' };
	const start = m[1] ? toDateOnly(m[1]) : '';
	const end = m[2] ? toDateOnly(m[2]) : '';
	return { start, end };
}

function toDateOnly(value: string): string {
	// Always go through `new Date()` for the conversion — Postgres can
	// return dates in ISO (`2024-01-15`), ISO with time (`2024-01-15 00:00:00+00`),
	// or the legacy 'Postgres' datestyle (`Mon Jan 15 00:00:00 2024`).
	// `new Date` accepts all three. We then return the UTC date portion.
	if (!value) return '';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return '';
	return d.toISOString().slice(0, 10);
}
