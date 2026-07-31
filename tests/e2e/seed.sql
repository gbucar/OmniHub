-- ============================================================================
-- E2E Test Seed Data for OmniHub Admin Dashboard
-- ============================================================================
-- This script is IDEMPOTENT — it can be run multiple times against the same
-- database without creating duplicate data.
--
-- Strategy:
--   1. CLEANUP  — delete ALL existing data (from populate.sql or previous runs)
--   2. INSERT   — deterministic test data with ON CONFLICT safety
--
-- ALL VALUES ARE DETERMINISTIC — no NOW(), no random(), fixed IDs throughout.
-- ============================================================================

SET search_path TO auth, data, public, postgis;

-- Ensure PostGIS is available for ST_GeogFromText()
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- 0. CLEANUP — Remove all existing data in FK-safe order
-- ============================================================================

-- Child tables first (respect FK dependencies)
DELETE FROM data.observations;
DELETE FROM data.data_streams;
DELETE FROM data.many_participants_studies;
DELETE FROM data.ownerships;
DELETE FROM data.participants;
DELETE FROM data.sensors;
DELETE FROM data.studies;
DELETE FROM data.locations;

-- Remove non-admin users. Admin stays for login-based tests.
DELETE FROM auth.users WHERE role != 'admin';

-- Reset auto-increment sequences so new data starts at predictable IDs
ALTER SEQUENCE IF EXISTS data.data_streams_id_seq   RESTART WITH 1;
ALTER SEQUENCE IF EXISTS data.locations_id_seq      RESTART WITH 1;
ALTER SEQUENCE IF EXISTS data.observations_id_seq   RESTART WITH 1;
ALTER SEQUENCE IF EXISTS data.sensors_id_seq        RESTART WITH 1;
ALTER SEQUENCE IF EXISTS data.studies_id_seq        RESTART WITH 1;

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
    ('00000000-0000-4000-a000-000000000006', 'test_participant_5', 'test123',         'webuser')
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- 2. PARTICIPANTS (data.participants)
-- ============================================================================

INSERT INTO data.participants (user_id, properties) VALUES
    ('00000000-0000-4000-a000-000000000002', '{"name": "Ana Test",    "age": 25, "sex": "female"}'::jsonb),
    ('00000000-0000-4000-a000-000000000003', '{"name": "Bojan Test",  "age": 32, "sex": "male"}'::jsonb),
    ('00000000-0000-4000-a000-000000000004', '{"name": "Cvetka Test", "age": 45, "sex": "female"}'::jsonb),
    ('00000000-0000-4000-a000-000000000005', '{"name": "David Test",  "age": 28, "sex": "male"}'::jsonb),
    ('00000000-0000-4000-a000-000000000006', '{"name": "Eva Test",    "age": 52, "sex": "female"}'::jsonb)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 3. SENSORS (data.sensors)
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
-- ============================================================================

INSERT INTO data.studies (name, active_period) VALUES
    ('Test Study Alpha',
     tstzrange('2024-01-01 00:00:00+00', '2025-12-31 23:59:59+00', '[]')),
    ('Test Study Beta',
     tstzrange('2024-06-01 00:00:00+00', '2025-06-30 23:59:59+00', '[]'));

-- ============================================================================
-- 6. STUDY ASSIGNMENTS (data.many_participants_studies)
--    Participants 1-3 → Alpha; Participants 4-5 → Beta
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
) AS ds (name, description, unit)
ON CONFLICT (sensor_id, name) DO NOTHING;

-- ============================================================================
-- 8. LOCATIONS (data.locations)
-- ============================================================================

INSERT INTO data.locations (geog, properties) VALUES
    (ST_GeogFromText('SRID=4326;POINT(14.5058 46.0569)'), '{"city": "Ljubljana"}'::jsonb),
    (ST_GeogFromText('SRID=4326;POINT(15.6459 46.5547)'), '{"city": "Maribor"}'::jsonb);

-- ============================================================================
-- 9. OBSERVATIONS (data.observations)
--    5 observations per stream at 10:00 and 5 at 11:00 for Test Sensor Alpha.
--    phenomenon_time uses tstzrange with degenerate [t, t] ranges.
--    All observations use Ljubljana location.
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
WHERE ds.sensor_id = (SELECT id FROM data.sensors WHERE name = 'Test Sensor Alpha')
ON CONFLICT (data_stream_id, phenomenon_time) DO NOTHING;

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
WHERE ds.sensor_id = (SELECT id FROM data.sensors WHERE name = 'Test Sensor Alpha')
ON CONFLICT (data_stream_id, phenomenon_time) DO NOTHING;
