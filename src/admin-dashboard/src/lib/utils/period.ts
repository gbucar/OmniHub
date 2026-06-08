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
				start: match[1].slice(1, -1).split(' ')[0],
				end: match[2].slice(1, -2).split(' ')[0]
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
				start: new Date(parsed[0].replace('+00', 'Z')).toLocaleDateString(),
				end: new Date(parsed[1].replace('+00', 'Z')).toLocaleDateString()
			};
		}
	} catch {
		const match = period.match(/\[([^,]+),\s*([^)]+)\)/);
		if (match) {
			return {
				start: new Date(match[1].replace('+00', 'Z')).toLocaleDateString(),
				end: new Date(match[2].replace('+00', 'Z')).toLocaleDateString()
			};
		}
	}
	return null;
}

export function buildMembershipPeriod(start: string, end: string): string | null {
	if (!start || !end) return null;
	return `[${start} 00:00:00, ${end} 23:59:59.99999999)`;
}
