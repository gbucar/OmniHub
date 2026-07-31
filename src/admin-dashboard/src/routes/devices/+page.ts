import type { PageLoad } from './$types';
import { getSensors, getSensorTypes } from '$lib/api';

export const load: PageLoad = async () => {
	const [sensorsResult, sensorTypes] = await Promise.all([
		getSensors({ limit: 100, offset: 0 }),
		getSensorTypes()
	]);

	return {
		sensors: sensorsResult.data,
		totalCount: sensorsResult.count,
		sensorTypes
	};
};
