import { pgClient } from './client';
import type { Participant } from './types';

export const getParticipants = async (filters?: {
	search?: string;
	study?: string;
	limit?: number;
	offset?: number;
}) => {
	let query = pgClient?.from('list_participants').select('*', { count: 'exact' });

	if (filters?.search) {
		query = query?.or(
			`username.ilike.%${filters.search}%,properties->>name.ilike.%${filters.search}%`
		);
	}

	if (filters?.study && filters.study !== 'all') {
		query = query?.eq('study_id', parseInt(filters.study));
	}

	if (filters?.limit) {
		query = query?.limit(filters.limit);
	}

	if (filters?.offset) {
		query = query?.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
	}

	const data = await query;
	return {
		data: (data?.data ?? []) as Participant[],
		count: data?.count ?? 0
	};
};

export const addParticipant = async (participant: {
	username: string;
	password: string;
	properties: Record<string, unknown>;
}) => {
	const data = await pgClient?.schema('api').rpc('add_participant', {
		username: participant.username,
		password: participant.password,
		properties: participant.properties
	});
	if (data?.error) {
		throw new Error(data.error.message);
	}
	return data?.data ?? null;
};

export const updateParticipant = async (participant: {
	user_id: string;
	properties: Record<string, unknown>;
}) => {
	const data = await pgClient
		?.from('participants')
		.update({
			properties: participant.properties
		})
		.eq('user_id', participant.user_id);
	if (data?.error) {
		throw new Error(data.error.message);
	}
	return data?.data ?? null;
};
