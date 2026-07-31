import type { PageLoad } from './$types';
import { getParticipants, getStudies, getSensors } from '$lib/api';

export const load: PageLoad = async () => {
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
