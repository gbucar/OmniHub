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

-- 2. VSTAVLJANJE 2 SENZORJEV (Atmotube)
INSERT INTO data.sensors (name, description, properties)
VALUES 
    ('Atmotube Pro 1', 'Prenosna naprava za kakovost zraka', '{"model": "Pro", "version": "2.0"}'::jsonb),
    ('Atmotube Pro 2', 'Prenosna naprava za kakovost zraka', '{"model": "Pro", "version": "2.1"}'::jsonb);

-- 3. VSTAVLJANJE LASTNIŠTVA (Ownerships)
-- Vsakemu od 5 uporabnikov dodelimo eno napravo (prvim trem prvo, ostalima dvema drugo)
INSERT INTO data.ownerships (user_id, sensor_id, start_date, end_date)
SELECT 
    p.user_id, 
    CASE 
        WHEN u.username IN ('janez_novak', 'marija_reka', 'luka_gora') THEN (SELECT id FROM data.sensors WHERE name = 'Atmotube Pro 1')
        ELSE (SELECT id FROM data.sensors WHERE name = 'Atmotube Pro 2')
    END as sensor_id,
    NOW() - INTERVAL '30 days',
    NOW() + INTERVAL '1 year'
FROM data.participants p
JOIN auth.users u ON p.user_id = u.id
WHERE u.role = 'webuser';

-- 4. VSTAVLJANJE DATASTREAM-ov (Pravilna uporaba unnest v JOIN-u)
INSERT INTO data.data_stream (sensor_id, name, description, unit_of_measurement)
SELECT 
    s.id, 
    t.st_name,
    'Meritve okolja iz Atmotube',
    CASE 
        WHEN t.st_name = 'temperature' THEN '{"unit": "Celsius", "symbol": "°C"}'::jsonb
        ELSE '{"unit": "Micrograms per Cubic Meter", "symbol": "µg/m³"}'::jsonb
    END
FROM data.sensors s
CROSS JOIN (SELECT unnest(ARRAY['temperature', 'pm25']) AS st_name) t;

-- 5. VSTAVLJANJE LOKACIJ
INSERT INTO data.locations (geog, properties)
VALUES 
    (ST_GeogFromText('SRID=4326;POINT(14.5058 46.0569)'), '{"city": "Ljubljana", "station": "Center"}'::jsonb),
    (ST_GeogFromText('SRID=4326;POINT(15.6459 46.5547)'), '{"city": "Maribor", "station": "Tezno"}'::jsonb);

-- 6. VSTAVLJANJE OPAZOVANJ (Observations)
-- Za vsak datastream vstavimo 2 meritvi
INSERT INTO data.observations (data_stream_id, phenomenon_time, result, location_id)
SELECT 
    ds.id,
    tstzrange(NOW() - (v.minut || ' minutes')::interval, NOW() - (v.minut || ' minutes')::interval, '[]'),
    CASE 
        WHEN ds.name = 'temperature' THEN (20 + (random() * 5))
        ELSE (5 + (random() * 15))
    END,
    (SELECT id FROM data.locations ORDER BY random() LIMIT 1) -- Naključna lokacija
FROM data.data_stream ds
CROSS JOIN (SELECT unnest(ARRAY[5, 10]) AS minut) v;

-- 7. NASTAVITVE POSTGREST
INSERT INTO config.app_settings
(setting_value, setting_name)
VALUES
    ('testsecrettestsecrettestsecrettestsecret', 'POSTGREST_JWT_SECRET'),
    ('3600', 'POSTGREST_JWT_DURATION_SECONDS');

-- 8. VSTAVLJANJE ŠTUDIJ (Studies)
INSERT INTO data.studies (name, "active-period")
VALUES 
    ('Študija kakovosti zraka Ljubljana', tstzrange('2024-01-01 00:00:00+00', '2025-12-31 23:59:59+00', '[]')),
    ('Pilotno spremljanje okolja', tstzrange('2024-06-01 00:00:00+00', '2024-12-31 23:59:59+00', '[]'));

-- 9. DODELITEV UDELEŽENCEV ŠTUDIJAM (Assign participants to studies)
-- Prvih 3 udeležencev dodelimo prvi študiji
INSERT INTO data.many_participants_studies (participant_id, study_id)
SELECT 
    p.user_id,
    (SELECT id FROM data.studies WHERE name = 'Študija kakovosti zraka Ljubljana')
FROM data.participants p
JOIN auth.users u ON p.user_id = u.id
WHERE u.username IN ('janez_novak', 'marija_reka', 'luka_gora');

-- Zadnja 2 udeleženca dodelimo drugi študiji
INSERT INTO data.many_participants_studies (participant_id, study_id)
SELECT 
    p.user_id,
    (SELECT id FROM data.studies WHERE name = 'Pilotno spremljanje okolja')
FROM data.participants p
JOIN auth.users u ON p.user_id = u.id
WHERE u.username IN ('ana_sonce', 'tine_hrib');




