-- Test: realistic observations spread across last 30 days
-- Compatible with pipeline stream names so pipeline finds and reuses them.
-- Pipeline streams: voc, pm1, pm25, pm10, t, h, p
-- Run: PGPASSWORD=postgres123 psql -h localhost -U postgres -d postgres -f src/db/dev/test_observations.sql
SET search_path TO data, public, postgis;

BEGIN;

-- Clean up previous test data (keep original seed data: obs 1-10, streams 1-205, loc 1)
DELETE FROM data.observations WHERE id > 10;
DELETE FROM data.data_streams WHERE id NOT IN (
    SELECT data_stream_id FROM data.observations WHERE id <= 10
);
DELETE FROM data.locations WHERE id NOT IN (
    SELECT location_id FROM data.observations WHERE id <= 10
);

-- 1. Create one location per sensor (random coords around Ljubljana)
INSERT INTO data.locations (properties, geog)
SELECT
    jsonb_build_object('city', 'Ljubljana', 'station', s.name),
    ST_SetSRID(ST_MakePoint(14.5 + random() * 0.1, 46.05 + random() * 0.05), 4326)
FROM data.sensors s
ON CONFLICT DO NOTHING;

-- 2. Create ALL 7 pipeline-compatible data streams per sensor.
--    Pipeline uses: voc, pm1, pm25, pm10, t, h, p
--    Pipeline code checks len(required) != len(saved) — finds all 7 → skips creation.
INSERT INTO data.data_streams (sensor_id, name, description, unit_of_measurement, properties)
SELECT s.id, t.name, t.descr, t.unit, '{}'::jsonb
FROM data.sensors s
CROSS JOIN (VALUES
    ('voc',  'Volatile Organic Compounds',  'ppb'),
    ('pm1',  'PM1.0 particulate matter',     'µg/m³'),
    ('pm25', 'PM2.5 particulate matter',     'µg/m³'),
    ('pm10', 'PM10 particulate matter',      'µg/m³'),
    ('t',    'Temperature',                  '°C'),
    ('h',    'Relative Humidity',            '%'),
    ('p',    'Atmospheric Pressure',         'mbar')
) AS t(name, descr, unit)
WHERE NOT EXISTS (
    SELECT 1 FROM data.data_streams d
    WHERE d.sensor_id = s.id AND d.name = t.name
);

-- 3. Create observations per data stream with varied recency.
--    Recency is staggered by sensor ID (s.id % 7 → 0..12 extra days),
--    so different sensors show different last_activity in the UI.
--    Each row gets random ±4h jitter computed once per row (LATERAL),
--    so measurements for different sensors are never at the same
--    timestamp.  Result values scale with sensor ID for visual variety
--    and are based on realistic Atmotube API response ranges.
INSERT INTO data.observations (data_stream_id, location_id, phenomenon_time, result)
SELECT
    ds.id,
    (SELECT l.id FROM data.locations l ORDER BY random() LIMIT 1),
    tstzrange(ts - interval '30 minutes', ts + interval '30 minutes'),
    round(
        CASE ds.name
            WHEN 'voc'  THEN 50  + random() * (50 + s.id * 20)   -- 50-850 ppb
            WHEN 'pm1'  THEN 1   + random() * (10 + s.id * 5)    -- 1-200 µg/m³
            WHEN 'pm25' THEN 2   + random() * (15 + s.id * 8)    -- 2-350 µg/m³
            WHEN 'pm10' THEN 3   + random() * (20 + s.id * 10)   -- 3-450 µg/m³
            WHEN 't'    THEN 15  + random() * (15 + s.id * 2)    -- 15-75 °C
            WHEN 'h'    THEN 40  + random() * (40 + s.id * 2)    -- 40-120 %
            WHEN 'p'    THEN 970 + random() * (20 + s.id * 1)    -- 970-1010 mbar
        END
    , 2)
FROM data.data_streams ds
JOIN data.sensors s ON s.id = ds.sensor_id
CROSS JOIN generate_series(1, 15) g
CROSS JOIN LATERAL (
    SELECT now() - (
        ((g::numeric - 1) / 14) * interval '30 days'     -- 0..30d base spread
        + (s.id % 7) * interval '2 days'                  -- 0..12d per-sensor offset
        + random() * interval '4 hours'                    -- 0..4h jitter
    ) AS ts
) base
WHERE NOT EXISTS (
    SELECT 1 FROM data.observations o
    WHERE o.data_stream_id = ds.id
);

COMMIT;

-- Verify
SELECT 'Locations: ' || count(*)::text FROM data.locations;
SELECT 'Data streams: ' || count(*)::text FROM data.data_streams;
SELECT 'Observations: ' || count(*)::text FROM data.observations;
SELECT 'Sensors with activity: ' || count(*)::text
FROM data.sensors s
WHERE EXISTS (
    SELECT 1 FROM data.data_streams ds
    JOIN data.observations o ON o.data_stream_id = ds.id
    WHERE ds.sensor_id = s.id
);
