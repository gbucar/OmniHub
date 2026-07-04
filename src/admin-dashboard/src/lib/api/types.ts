export type Sensor = {
	id: number;
	name: string;
	description?: string;
	properties?: Record<string, unknown>;
	credential_id?: number;
	sys_created_at?: string;
	last_activity?: string;
	/**
	 * Sensor classification (e.g. "ATMOTUBE_PRO"). Stored as
	 * `data.sensors.sensor_type` and exposed by both the `sensors` and
	 * `list_sensors` views. `Sensor` is sourced from `list_sensors` which
	 * selects `s.*` — so the field is present on returned rows.
	 */
	sensor_type?: string;
};

export type DataStream = {
	id: number;
	sensor_id: number;
	name: string;
	description?: string | null;
	unit_of_measurement?: string | null;
	properties?: Record<string, unknown> | null;
};

export type SensorOwnership = Ownership & {
	username: string | null;
	participant_name: string | null;
};

export type RecentObservation = {
	id: number;
	data_stream_id: number;
	data_stream_name: string;
	phenomenon_time: string;
	result: number;
	location: string | null;
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
	/**
	 * Free-text participant classification. Stored as `properties->>'type'`
	 * in `data.participants`. Derived on read for convenience.
	 */
	type: string | null;
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
