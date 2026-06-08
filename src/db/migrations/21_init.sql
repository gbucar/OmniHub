-- Migration 21: Fix list_participants view to show participants without study assignments

CREATE OR REPLACE VIEW api.list_participants
WITH (security_invoker=true)
AS
SELECT p.user_id,
    p.properties,
    p.sys_created_at,
    p.sys_changed_at,
    u.username,
    u.role,
    s.name AS study_name,
    s.id as study_id
   FROM data.participants p
     JOIN auth.users u ON u.id = p.user_id
     LEFT JOIN data.many_participants_studies mps ON p.user_id = mps.user_id
     LEFT JOIN data.studies s ON s.id = mps.study_id;

ALTER VIEW api.list_participants OWNER TO postgres;
