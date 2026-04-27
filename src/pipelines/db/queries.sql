-- name: ListAtmotubes :many
select s.id as sensor_id, (s.properties->>'atmotube_id')::text as atmotube_id, (c.properties->>'api_key')::text as api_key from data.sensors s
left join auth.credentials c on s.credential_id = c.id
where s.sensor_type = 'ATMOTUBE_PRO';

-- name: GetDataStreams :many
select id, name from data.data_streams eds
where eds.sensor_id = $1;


-- name: CreateDataStream :one
insert into data.data_streams (
    sensor_id,
    name,
    description,
    unit_of_measurement,
    properties
) values (
    $1,$2,$3,$4,$5
) returning id;


-- name: CreateLocation :one
insert into data.locations (
    geog,
    properties
) values (
    ST_SetSRID(ST_MakePoint(@lon::float, @lat::float), 4326)::geography,$1
) on conflict (geog)
do update set geog = excluded.geog
returning id;

-- name: CreateObservation :exec
insert into data.observations (
    data_stream_id,
    phenomenon_time,
    result,
    properties,
    location_id
) values (
    $1,$2,$3,$4,$5
) on conflict (data_stream_id, phenomenon_time) do nothing;

-- name: ExecutionLog :exec
insert into log.integration_execution (
    name,
    datetime,
    value
) values (
    $1,$2,$3
);
