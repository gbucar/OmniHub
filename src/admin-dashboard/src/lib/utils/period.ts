export function parseMembershipPeriod(period: string): { start: string; end: string } | null {
	try {
		const parsed = JSON.parse(period);
		if (Array.isArray(parsed) && parsed.length === 2) {
			return {
				start: parsed[0].split(' ')[0],
				end: parsed[1].split(' ')[0]
			};
		}
	} catch {
		const match = period.match(/\[([^,]+),\s*([^)]+)\)/);
		if (match) {
			return {
				start: match[1].replace(/"/g, '').trim().split(' ')[0],
				end: match[2].replace(/"/g, '').trim().split(' ')[0]
			};
		}
	}
	return null;
}

export function formatMembershipPeriodDisplay(
	period: string
): { start: string; end: string } | null {
	try {
		const parsed = JSON.parse(period);
		if (Array.isArray(parsed) && parsed.length === 2) {
			return {
				start: parsed[0].split(' ')[0],
				end: parsed[1].split(' ')[0]
			};
		}
	} catch {
		const match = period.match(/\[([^,]+),\s*([^)]+)\)/);
		if (match) {
			return {
				start: match[1].replace(/"/g, '').trim().split(' ')[0],
				end: match[2].replace(/"/g, '').trim().split(' ')[0]
			};
		}
	}
	return null;
}

export function buildMembershipPeriod(start: string, end: string): string | null {
	if (!start || !end) return null;
	return `[${start} 00:00:00, ${end} 23:59:59.99999999)`;
}
