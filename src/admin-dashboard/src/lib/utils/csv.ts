/**
 * RFC 4180 compliant CSV utilities — no external dependencies.
 *
 * Conventions:
 *   - Delimiter: comma (`,`).
 *   - Quote character: double-quote (`"`).
 *   - Embedded quotes are escaped by doubling (`""` inside a quoted field).
 *   - Embedded newlines are allowed inside quoted fields.
 *   - Line ending on output: CRLF (`\r\n`) for Excel compatibility.
 *   - All output fields are always quoted (safer when fields contain
 *     commas, newlines, or quotes — at the cost of a slightly larger file).
 *
 * `parseCSV` returns the raw values verbatim (no coercion). Empty cells
 * become the empty string `""`. A trailing empty line (from a final CRLF)
 * is not added as an empty row.
 */

export type CsvParseResult = {
	headers: string[];
	rows: string[][];
};

const DELIM = ',';

/**
 * Parse an RFC 4180 CSV string into headers + rows.
 *
 * Robust against:
 *   - Quoted fields containing the delimiter (`"a,b"` → `a,b`).
 *   - Quoted fields containing newlines (`"line1\nline2"`).
 *   - Escaped quotes inside quoted fields (`"a""b"` → `a"b`).
 *   - Mixed CRLF and LF line endings.
 *   - A leading UTF-8 BOM (`\ufeff`) — Excel always emits one. Without
 *     stripping, the first header would be `\ufeffusername` and would
 *     fail any alias-based auto-detection.
 */
export function parseCSV(text: string, _delimiter: string = DELIM): CsvParseResult {
	// Strip a leading UTF-8 BOM (Excel) and normalize line endings. We
	// emit CRLF on output but accept both CRLF and LF on input.
	const normalized = text.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');

	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;
	let i = 0;
	const n = normalized.length;

	while (i < n) {
		const ch = normalized[i];

		if (inQuotes) {
			if (ch === '"') {
				// Look ahead — doubled quote is an escaped quote, a single
				// quote followed by delim/newline/eof ends the quoted field.
				if (i + 1 < n && normalized[i + 1] === '"') {
					field += '"';
					i += 2;
					continue;
				}
				inQuotes = false;
				i++;
				continue;
			}
			field += ch;
			i++;
			continue;
		}

		// Not in quotes.
		if (ch === '"') {
			// A quote at the start of a field opens a quoted field. A quote
			// appearing mid-field is a malformed CSV — we still treat it as
			// a literal quote to be lenient.
			if (field === '') {
				inQuotes = true;
				i++;
				continue;
			}
			field += ch;
			i++;
			continue;
		}
		if (ch === DELIM) {
			row.push(field);
			field = '';
			i++;
			continue;
		}
		if (ch === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			i++;
			continue;
		}
		field += ch;
		i++;
	}

	// Flush the last field/row (only if the input didn't end with a newline).
	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	if (rows.length === 0) {
		return { headers: [], rows: [] };
	}

	const [headers, ...dataRows] = rows;
	return { headers, rows: dataRows };
}

/**
 * Quote a single field per RFC 4180. We always quote — the file is larger
 * but trivially safe against commas, newlines, and leading/trailing spaces
 * in cell values.
 */
function quoteField(value: string): string {
	// Defensive: ensure we always call .replace() on a string.
	// When building CSV rows from parsed DB data, some fields
	// (e.g. `age` from jsonb `properties`) may arrive as numbers
	// instead of strings.
	const str = String(value ?? '');
	const escaped = str.replace(/"/g, '""');
	return `"${escaped}"`;
}

/**
 * Serialize headers + rows to an RFC 4180 CSV string (CRLF line endings,
 * all fields quoted).
 */
export function serializeCSV(headers: string[], rows: string[][]): string {
	const lines: string[] = [];
	lines.push(headers.map(quoteField).join(DELIM));
	for (const row of rows) {
		// Pad short rows with empty cells so all rows have the same width as
		// the header — defensive against accidental shape mismatches.
		const cells = headers.map((_, idx) => quoteField(row[idx] ?? ''));
		lines.push(cells.join(DELIM));
	}
	// Trailing CRLF is allowed by RFC 4180 and Excel-friendly.
	return lines.join('\r\n') + '\r\n';
}

/**
 * Trigger a browser download of a CSV string. The MIME type is set to
 * `text/csv;charset=utf-8` so spreadsheet apps recognize the file.
 */
export function downloadCSV(filename: string, content: string): void {
	if (typeof window === 'undefined' || typeof document === 'undefined') {
		// Not in a browser environment — silently no-op. Callers should
		// avoid this path (we only ever use it from event handlers).
		return;
	}
	const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	// Defer revoke so the browser has time to start the download.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
