-- Migration 21: Fix list_participants view to show participants without study
-- assignments and return one row per user with aggregated studies (JSON array).

CREATE OR REPLACE VIEW api.list_participants
WITH (security_invoker=true)
AS
SELECT p.user_id,
    p.properties,
    p.sys_created_at,
    p.sys_changed_at,
    u.username,
    u.role,
    COALESCE(
        json_agg(json_build_object('id', s.id, 'name', s.name))
        FILTER (WHERE s.id IS NOT NULL),
        '[]'::json
    ) AS studies,
    MIN(s.name) AS study_name,
    MIN(s.id)   AS study_id
FROM data.participants p
JOIN auth.users u ON u.id = p.user_id
LEFT JOIN data.many_participants_studies mps ON p.user_id = mps.user_id
LEFT JOIN data.studies s ON s.id = mps.study_id
GROUP BY p.user_id, p.properties, p.sys_created_at, p.sys_changed_at, u.username, u.role;

ALTER VIEW api.list_participants OWNER TO postgres;
