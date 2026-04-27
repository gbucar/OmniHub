-- Nastavitev poti
SET search_path TO auth, data, public;
-- 1. Vstavljanje ADMIN uporabnika
INSERT INTO auth.users (username, password, role)
VALUES ('admin_user', 'admin_geslo_123', 'admin');

-- 2. Vstavljanje 5 WEBUSER uporabnikov
INSERT INTO auth.users (username, password, role)
VALUES 
    ('janez_novak', 'geslo123', 'webuser'),
    ('marija_reka', 'geslo123', 'webuser'),
    ('luka_gora',   'geslo123', 'webuser'),
    ('ana_sonce',   'geslo123', 'webuser'),
    ('tine_hrib',   'geslo123', 'webuser');

-- 1. POSODOBITEV UDELEŽENCEV (Participants)
-- Zagotovimo, da vseh 5 webuserjev obstaja v tabeli participants
INSERT INTO data.participants (user_id, properties)
SELECT id, '{"type": "citizen_scientist"}'::jsonb
FROM auth.users
WHERE role = 'webuser'
ON CONFLICT (user_id) DO NOTHING;



-- 3. VSTAVLJANJE LASTNIŠTVA (Ownerships)
-- Vsakemu od 5 uporabnikov dodelimo eno napravo (vsak svojo)
INSERT INTO data.ownerships (user_id, sensor_id, start_date, end_date)
SELECT 
    p.user_id, 
CASE u.username
    WHEN 'janez_novak' THEN (SELECT id FROM data.sensors WHERE id = 1)
    WHEN 'marija_reka' THEN (SELECT id FROM data.sensors WHERE id = 2)
    WHEN 'luka_gora' THEN (SELECT id FROM data.sensors WHERE id = 3)
    WHEN 'ana_sonce' THEN (SELECT id FROM data.sensors WHERE id = 4)
    WHEN 'tine_hrib' THEN (SELECT id FROM data.sensors WHERE id = 5)
END as sensor_id,
    NOW() - INTERVAL '30 days',
    NOW() + INTERVAL '1 year'
FROM data.participants p
JOIN auth.users u ON p.user_id = u.id
WHERE u.role = 'webuser';

-- 7. NASTAVITVE POSTGREST
INSERT INTO config.app_settings
(setting_value, setting_name)
VALUES
    ('testsecrettestsecrettestsecrettestsecret', 'POSTGREST_JWT_SECRET'),
    ('3600', 'POSTGREST_JWT_DURATION_SECONDS');

INSERT INTO data.studies (name, active_period)
VALUES 
    ('Študija kakovosti zraka Ljubljana', tstzrange('2024-01-01 00:00:00+00', '2025-12-31 23:59:59+00', '[]')),
    ('Pilotno spremljanje okolja', tstzrange('2024-06-01 00:00:00+00', '2024-12-31 23:59:59+00', '[]'));

-- 9. DODELITEV UDELEŽENCEV ŠTUDIJAM (Assign participants to studies)
-- Prvih 3 udeležencev dodelimo prvi študiji
INSERT INTO data.many_participants_studies (user_id, study_id, membership_period)
SELECT 
    p.user_id,
    (SELECT id FROM data.studies WHERE name = 'Študija kakovosti zraka Ljubljana'),
    (SELECT active_period FROM data.studies WHERE name = 'Študija kakovosti zraka Ljubljana')
FROM data.participants p
JOIN auth.users u ON p.user_id = u.id
WHERE u.username IN ('janez_novak', 'marija_reka', 'luka_gora');

-- Zadnja 2 udeleženca dodelimo drugi študiji
INSERT INTO data.many_participants_studies (user_id, study_id, membership_period)
SELECT 
    p.user_id,
    (SELECT id FROM data.studies WHERE name = 'Pilotno spremljanje okolja'),
    (SELECT active_period FROM data.studies WHERE name = 'Pilotno spremljanje okolja')
FROM data.participants p
JOIN auth.users u ON p.user_id = u.id
WHERE u.username IN ('ana_sonce', 'tine_hrib');
