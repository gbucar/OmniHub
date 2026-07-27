-- ============================================================================
-- E2E Test Seed Data for OmniHub Admin Dashboard
-- ============================================================================
-- Executed against a fresh TimescaleDB with all migrations applied.
-- ALL VALUES ARE DETERMINISTIC — no NOW(), no random(), fixed IDs throughout.
-- ============================================================================

SET search_path TO auth, data, public;

-- ============================================================================
-- 1. USERS (auth.users)
--    Passwords are bcrypt-hashed automatically by the encrypt_pass trigger.
--    Raw passwords: admin=admin_geslo_123, participants=test123
-- ============================================================================

INSERT INTO auth.users (id, username, password, role) VALUES
    ('00000000-0000-4000-a000-000000000001', 'admin_user',        'admin_geslo_123', 'admin'),
    ('00000000-0000-4000-a000-000000000002', 'test_participant_1', 'test123',         'webuser'),
    ('00000000-0000-4000-a000-000000000003', 'test_participant_2', 'test123',         'webuser'),
    ('00000000-0000-4000-a000-000000000004', 'test_participant_3', 'test123',         'webuser'),
    ('00000000-0000-4000-a000-000000000005', 'test_participant_4', 'test123',         'webuser'),
    ('00000000-0000-4000-a000-000000000006', 'test_participant_5', 'test123',         'webuser');

-- ============================================================================
-- 2. PARTICIPANTS (data.participants)
-- ============================================================================

INSERT INTO data.participants (user_id, properties) VALUES
    ('00000000-0000-4000-a000-000000000002', '{"name": "Ana Test",    "age": 25, "sex": "female"}'::jsonb),
    ('00000000-0000-4000-a000-000000000003', '{"name": "Bojan Test",  "age": 32, "sex": "male"}'::jsonb),
    ('00000000-0000-4000-a000-000000000004', '{"name": "Cvetka Test", "age": 45, "sex": "female"}'::jsonb),
    ('00000000-0000-4000-a000-000000000005', '{"name": "David Test",  "age": 28, "sex": "male"}'::jsonb),
    ('00000000-0000-4000-a000-000000000006', '{"name": "Eva Test",    "age": 52, "sex": "female"}'::jsonb);

-- ============================================================================
-- 3. SENSORS (data.sensors)
--    id is bigserial — auto-assigned: Alpha=1, Beta=2
-- ============================================================================

INSERT INTO data.sensors (sensor_type, name, description, properties) VALUES
    ('ATMOTUBE_PRO', 'Test Sensor Alpha',
     'Atmotube Pro sensor for air quality monitoring',
     '{"status": "active"}'::jsonb),
    ('ATMOAIR_V2', 'Test Sensor Beta',
     'AtmoAir V2 sensor for air quality monitoring',
     '{"status": "inactive"}'::jsonb);

-- ============================================================================
-- 4. OWNERSHIPS (data.ownerships)
--    Participants 1,2 → Sensor Alpha; Participant 3 → Sensor Beta
-- ============================================================================

INSERT INTO data.ownerships (user_id, sensor_id, start_date, end_date)
SELECT
    p.user_id,
    CASE u.username
        WHEN 'test_participant_1' THEN (SELECT id FROM data.sensors WHERE name = 'Test Sensor Alpha')
        WHEN 'test_participant_2' THEN (SELECT id FROM data.sensors WHERE name = 'Test Sensor Alpha')
        WHEN 'test_participant_3' THEN (SELECT id FROM data.sensors WHERE name = 'Test Sensor Beta')
    END AS sensor_id,
    '2024-03-01 00:00:00+00'::timestamptz,
    '2025-03-01 00:00:00+00'::timestamptz
FROM data.participants p
JOIN auth.users u ON p.user_id = u.id
WHERE u.username IN ('test_participant_1', 'test_participant_2', 'test_participant_3');

-- ============================================================================
-- 5. STUDIES (data.studies)
--    id is bigserial — auto-assigned: Alpha=1, Beta=2
-- ============================================================================

INSERT INTO data.studies (name, active_period) VALUES
    ('Test Study Alpha',
     tstzrange('2024-01-01 00:00:00+00', '2025-12-31 23:59:59+00', '[]')),
    ('Test Study Beta',
     tstzrange('2024-06-01 00:00:00+00', '2025-06-30 23:59:59+00', '[]'));

-- ============================================================================
-- 6. STUDY ASSIGNMENTS (data.many_participants_studies)
--    Participants 1-3 → Alpha (use Alpha's active_period for membership_period)
--    Participants 4-5 → Beta  (use Beta's active_period for membership_period)
-- ============================================================================

INSERT INTO data.many_participants_studies (user_id, study_id, membership_period)
SELECT
    p.user_id,
    (SELECT id FROM data.studies WHERE name = 'Test Study Alpha'),
    tstzrange('2024-01-01 00:00:00+00', '2025-12-31 23:59:59+00', '[]')
FROM data.participants p
JOIN auth.users u ON p.user_id = u.id
WHERE u.username IN ('test_participant_1', 'test_participant_2', 'test_participant_3');

INSERT INTO data.many_participants_studies (user_id, study_id, membership_period)
SELECT
    p.user_id,
    (SELECT id FROM data.studies WHERE name = 'Test Study Beta'),
    tstzrange('2024-06-01 00:00:00+00', '2025-06-30 23:59:59+00', '[]')
FROM data.participants p
JOIN auth.users u ON p.user_id = u.id
WHERE u.username IN ('test_participant_4', 'test_participant_5');

-- ============================================================================
-- 7. DATA STREAMS (data.data_streams)
--    5 streams per sensor: temperature, humidity, pm25, pm10, voc
--    Uses CROSS JOIN VALUES to create all combinations.
--    UNIQUE constraint on (sensor_id, name) is satisfied because each
--    (sensor_id × stream_name) pair is unique.
-- ============================================================================

INSERT INTO data.data_streams (sensor_id, name, description, unit_of_measurement, properties)
SELECT
    s.id,
    ds.name,
    ds.description,
    ds.unit,
    '{}'::jsonb
FROM data.sensors s
CROSS JOIN (VALUES
    ('temperature', 'Temperature measurement',            '°C'),
    ('humidity',    'Relative humidity measurement',       '%'),
    ('pm25',        'PM2.5 particulate matter',            'µg/m³'),
    ('pm10',        'PM10 particulate matter',             'µg/m³'),
    ('voc',         'Volatile organic compounds',          'ppb')
) AS ds (name, description, unit);

-- ============================================================================
-- 8. LOCATIONS (data.locations)
--    id is bigserial — auto-assigned: Ljubljana=1, Maribor=2
-- ============================================================================

INSERT INTO data.locations (geog, properties) VALUES
    (ST_GeogFromText('SRID=4326;POINT(14.5058 46.0569)'), '{"city": "Ljubljana"}'::jsonb),
    (ST_GeogFromText('SRID=4326;POINT(15.6459 46.5547)'), '{"city": "Maribor"}'::jsonb);

-- ============================================================================
-- 9. OBSERVATIONS (data.observations)
--    5 observations per stream at 10:00 and 5 at 11:00 for Test Sensor Alpha only.
--    phenomenon_time uses tstzrange with degenerate [t, t] ranges.
--    UNIQUE constraint on (data_stream_id, phenomenon_time) is satisfied
--    because each time slot is unique per stream.
--    location_id: all observations use Ljubljana (id=1).
-- ============================================================================

-- Batch 1: 2026-01-15 10:00:00+00
INSERT INTO data.observations (data_stream_id, phenomenon_time, result, location_id)
SELECT
    ds.id,
    tstzrange('2026-01-15 10:00:00+00', '2026-01-15 10:00:00+00', '[]'),
    CASE ds.name
        WHEN 'temperature' THEN 22.5
        WHEN 'humidity'    THEN 55.0
        WHEN 'pm25'        THEN 12.3
        WHEN 'pm10'        THEN 18.7
        WHEN 'voc'         THEN 150.0
    END,
    (SELECT id FROM data.locations WHERE properties->>'city' = 'Ljubljana')
FROM data.data_streams ds
WHERE ds.sensor_id = (SELECT id FROM data.sensors WHERE name = 'Test Sensor Alpha');

-- Batch 2: 2026-01-15 11:00:00+00
INSERT INTO data.observations (data_stream_id, phenomenon_time, result, location_id)
SELECT
    ds.id,
    tstzrange('2026-01-15 11:00:00+00', '2026-01-15 11:00:00+00', '[]'),
    CASE ds.name
        WHEN 'temperature' THEN 23.1
        WHEN 'humidity'    THEN 52.0
        WHEN 'pm25'        THEN 14.5
        WHEN 'pm10'        THEN 20.1
        WHEN 'voc'         THEN 165.0
    END,
    (SELECT id FROM data.locations WHERE properties->>'city' = 'Ljubljana')
FROM data.data_streams ds
WHERE ds.sensor_id = (SELECT id FROM data.sensors WHERE name = 'Test Sensor Alpha');
