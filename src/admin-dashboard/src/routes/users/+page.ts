import { browser } from '$app/environment';
import type { PageLoad } from './$types';
import { getParticipants, getStudies, getSensors } from '$lib/api';
import type { Sensor } from '$lib/api';

export const load: PageLoad = async () => {
	// On the server (SSR), the PostgREST client is null — return empty data.
	// During client-side navigation, browser is true and we fetch real data.
	if (!browser) {
		return {
			participants: [],
			totalCount: 0,
			studies: [],
			sensors: [] as Sensor[]
		};
	}

	const [participantsResult, studies, sensorsResult] = await Promise.all([
		getParticipants({ limit: 100, offset: 0 }),
		getStudies(),
		getSensors()
	]);

	return {
		participants: participantsResult.data,
		totalCount: participantsResult.count,
		studies,
		sensors: sensorsResult.data
	};
};
