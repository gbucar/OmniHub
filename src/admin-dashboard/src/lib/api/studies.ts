import { pgClient } from './client';
import type { Study, ParticipantStudy } from './types';

export const getStudies = async (): Promise<Study[]> => {
	const data = await pgClient?.from('studies').select('id, name');
	return (data?.data ?? []) as Study[];
};

export const addStudy = async (study: {
	name: string;
	activePeriodStart: string;
	activePeriodEnd: string;
}) => {
	const rangeString = `[${study.activePeriodStart},${study.activePeriodEnd})`;
	const data = await pgClient
		?.from('studies')
		.insert({ name: study.name, active_period: rangeString });
	if (data?.error) {
		throw new Error(data.error.message);
	}
	return data?.data ?? null;
};

export const getParticipantStudies = async (userId: string): Promise<ParticipantStudy[]> => {
	const data = await pgClient
		?.from('many_participants_studies')
		.select(
			`
		study_id,
		membership_period,
		studies!inner (
			id,
			name
		)
	`
		)
		.eq('user_id', userId);

	const raw = data?.data ?? [];
	return raw.map((item: Record<string, unknown>) => ({
		study_id: item.study_id as number,
		membership_period: item.membership_period as string | null,
		studies: (item.studies as unknown as { id: number; name: string }[])[0]
	})) as ParticipantStudy[];
};

export const addParticipantToStudy = async (
	userId: string,
	studyId: number,
	membershipPeriod?: string | null
) => {
	const data = await pgClient?.from('many_participants_studies').insert({
		user_id: userId,
		study_id: studyId,
		membership_period: membershipPeriod || null
	});
	if (data?.error) {
		throw new Error(data.error.message);
	}
	return data?.data ?? null;
};

export const updateParticipantStudyPeriod = async (
	userId: string,
	studyId: number,
	membershipPeriod: string | null
) => {
	const data = await pgClient
		?.from('many_participants_studies')
		.update({ membership_period: membershipPeriod })
		.eq('user_id', userId)
		.eq('study_id', studyId);
	if (data?.error) {
		throw new Error(data.error.message);
	}
	return data?.data ?? null;
};
