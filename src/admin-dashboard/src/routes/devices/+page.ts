import { browser } from '$app/environment';
import type { PageLoad } from './$types';
import { getSensors } from '$lib/api';
import type { Sensor } from '$lib/api';

export const load: PageLoad = async () => {
	// On the server (SSR), the PostgREST client is null — return empty data.
	// During client-side navigation, browser is true and we fetch real data.
	if (!browser) {
		return {
			sensors: [] as Sensor[],
			totalCount: 0
		};
	}

	const sensors = await getSensors();

	return {
		sensors,
		totalCount: sensors.length
	};
};
