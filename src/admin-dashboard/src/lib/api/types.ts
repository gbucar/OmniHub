export type Sensor = {
	id: number;
	name: string;
	description?: string;
	properties?: Record<string, unknown>;
	credential_id?: number;
	sys_created_at?: string;
	last_activity?: string;
};

export type Ownership = {
	user_id: string;
	sensor_id: number;
	start_date: string;
	end_date: string;
	sys_created_at?: string;
	list_sensors?: Sensor;
};

export type Participant = {
	user_id: string;
	username: string | null;
	role: string | null;
	properties: Record<string, unknown> | null;
	/** All studies this participant is a member of. Empty array if none. */
	studies: Study[];
	/**
	 * @deprecated Kept for backward compatibility — always equals the first
	 * study's name (or null). Prefer `participant.studies` in new code.
	 */
	study_name: string | null;
	/**
	 * @deprecated Kept for backward compatibility — always equals the first
	 * study's id (or null). Prefer `participant.studies` in new code.
	 */
	study_id: number | null;
};

export type Study = {
	id: number;
	name: string;
};

export type ParticipantStudy = {
	study_id: number;
	membership_period: string | null;
	studies: Study;
};

export type User = {
	username: string | null;
	isLoggedIn: boolean;
};

export function createUser(username: string | null): User {
	return {
		username,
		isLoggedIn: !!username
	};
}
