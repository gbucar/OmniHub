package atmotube

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"omnihub/pipelines/db"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type AtmotubeDataCoords struct {
	Lat *float64 `json:"lat"`
	Lon *float64 `json:"lon"`
}

type AtmotubeDataItem struct {
	Voc         *float64            `json:"voc"`
	PM1         *float64            `json:"pm1"`
	PM25        *float64            `json:"pm25"`
	PM10        *float64            `json:"pm10"`
	Temperature *float64            `json:"t"`
	Humidity    *float64            `json:"h"`
	Pressure    *float64            `json:"p"`
	Time        time.Time           `json:"time"`
	Coords      *AtmotubeDataCoords `json:"coords"`
}

type AtmotubeResponse struct {
	Status int64 `json:"status"`
	Data   *struct {
		Items []AtmotubeDataItem `json:"items"`
	} `json:"data"`
}

func Extract(ctx context.Context, client *http.Client, atmotubeId string, apiKey string, startDate time.Time, endDate time.Time) ([]AtmotubeDataItem, error) {

	atmotubeUrl, err := url.Parse("https://api.atmotube.com/api/v1/data")

	if err != nil {
		return []AtmotubeDataItem{}, fmt.Errorf("parsing url: %w", err)
	}

	q := atmotubeUrl.Query()

	q.Set("api_key", apiKey)
	q.Set("mac", atmotubeId)
	q.Set("start_date", startDate.Format(time.DateOnly))
	q.Set("end_date", endDate.Format(time.DateOnly))

	atmotubeUrl.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, "GET", atmotubeUrl.String(), nil)

	if err != nil {
		return []AtmotubeDataItem{}, fmt.Errorf("building the request: %w", err)
	}

	res, err := client.Do(req)

	if err != nil {
		return []AtmotubeDataItem{}, fmt.Errorf("executing the request: %w", err)
	}

	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		if res.StatusCode == http.StatusTooManyRequests {
			time.Sleep(1 * time.Second)
			return Extract(ctx, client, atmotubeId, apiKey, startDate, endDate)
		} else {
			return []AtmotubeDataItem{}, fmt.Errorf("Bad status getting measurements from atmotube API for atmotube %s: %s", atmotubeId, res.Status)
		}
	}

	var apiResponse AtmotubeResponse

	if err := json.NewDecoder(res.Body).Decode(&apiResponse); err != nil {
		panic(err)
	}

	if apiResponse.Data == nil {
		return []AtmotubeDataItem{}, nil
	}

	return apiResponse.Data.Items, nil

}

type DataStream struct {
	SensorID          int64
	Name              string
	UnitOfMeasurement string
	Description       string
	Id                int64
}

func addObservationIfNotNil(result *float64, dataStreamId int64, phenomenonTime pgtype.Range[pgtype.Timestamptz], locationId pgtype.Int8, observations []db.CreateObservationParams) []db.CreateObservationParams {

	if result != nil {
		observations = append(observations,
			db.CreateObservationParams{
				DataStreamID:   dataStreamId,
				PhenomenonTime: phenomenonTime,
				LocationID:     locationId,
				Result:         *result,
			},
		)
	}

	return observations

}

func Load(atmotube db.ListAtmotubesRow, vals []AtmotubeDataItem, ctx context.Context, queries *db.Queries, conn *pgx.Conn) error {

	requiredDataStreams := map[string](*DataStream){
		"voc":  {SensorID: atmotube.SensorID, Name: "voc", UnitOfMeasurement: "ppm", Description: "VOC value"},
		"pm1":  {SensorID: atmotube.SensorID, Name: "pm1", UnitOfMeasurement: "µg/m3", Description: "PM 1 value"},
		"pm25": {SensorID: atmotube.SensorID, Name: "pm25", UnitOfMeasurement: "µg/m3", Description: "PM 2.5 value"},
		"pm10": {SensorID: atmotube.SensorID, Name: "pm10", UnitOfMeasurement: "µg/m3", Description: "PM 10 value"},
		"t":    {SensorID: atmotube.SensorID, Name: "t", UnitOfMeasurement: "°C", Description: "Temperature"},
		"h":    {SensorID: atmotube.SensorID, Name: "h", UnitOfMeasurement: "%", Description: "Humidity"},
		"p":    {SensorID: atmotube.SensorID, Name: "p", UnitOfMeasurement: "mbar", Description: "Pressure"},
	}

	// get dataStreams or ensure they exist
	savedDataStreams, err := queries.GetDataStreams(ctx, pgtype.Int8{
		Int64: atmotube.SensorID,
		Valid: true,
	})

	if err != nil {
		return err
	}

	if len(requiredDataStreams) != len(savedDataStreams) {
		for key, dataStream := range requiredDataStreams {

			dataStreamId, err := queries.CreateDataStream(
				ctx,
				db.CreateDataStreamParams{
					SensorID: pgtype.Int8{
						Int64: dataStream.SensorID,
						Valid: true,
					},
					Name: pgtype.Text{
						String: dataStream.Name,
						Valid:  true,
					},
					UnitOfMeasurement: pgtype.Text{
						String: dataStream.UnitOfMeasurement,
						Valid:  true,
					},
					Description: pgtype.Text{
						String: dataStream.Description,
						Valid:  true,
					},
				},
			)

			requiredDataStreams[key].Id = dataStreamId
			if err != nil {
				return fmt.Errorf("creating dataStream (sensorId: %d, name: %s): %w", dataStream.SensorID, dataStream.Name, err)
			}
		}
	} else {
		for _, savedDataStream := range savedDataStreams {
			requiredDataStreams[savedDataStream.Name.String].Id = savedDataStream.ID
		}
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("starting transaction (atmotubeId: %s): %w", atmotube.AtmotubeID, err)
	}
	defer tx.Rollback(ctx)

	for _, val := range vals {

		locationId := pgtype.Int8{
			Valid: false,
		}

		if val.Coords != nil {

			_locationId, err := queries.WithTx(tx).CreateLocation(ctx, db.CreateLocationParams{
				Properties: nil,
				Lon:        *val.Coords.Lon,
				Lat:        *val.Coords.Lat,
			})

			if err != nil {
				return fmt.Errorf("Error inserting location for atmotube %s: %v\n", atmotube.AtmotubeID, err)
			}

			locationId = pgtype.Int8{Int64: _locationId, Valid: true}

		}

		phenomenonTime := pgtype.Range[pgtype.Timestamptz]{
			Lower:     pgtype.Timestamptz{Time: val.Time.Add(-time.Minute), Valid: true},
			Upper:     pgtype.Timestamptz{Time: val.Time, Valid: true},
			LowerType: pgtype.Inclusive,
			UpperType: pgtype.Inclusive,
			Valid:     true,
		}

		var observations []db.CreateObservationParams
		observations = addObservationIfNotNil(val.Voc, requiredDataStreams["voc"].Id, phenomenonTime, locationId, observations)
		observations = addObservationIfNotNil(val.PM1, requiredDataStreams["pm1"].Id, phenomenonTime, locationId, observations)
		observations = addObservationIfNotNil(val.PM25, requiredDataStreams["pm25"].Id, phenomenonTime, locationId, observations)
		observations = addObservationIfNotNil(val.PM10, requiredDataStreams["pm10"].Id, phenomenonTime, locationId, observations)
		observations = addObservationIfNotNil(val.Temperature, requiredDataStreams["t"].Id, phenomenonTime, locationId, observations)
		observations = addObservationIfNotNil(val.Humidity, requiredDataStreams["h"].Id, phenomenonTime, locationId, observations)
		observations = addObservationIfNotNil(val.Pressure, requiredDataStreams["p"].Id, phenomenonTime, locationId, observations)

		for _, observation := range observations {
			err := queries.WithTx(tx).CreateObservation(ctx, observation)

			if err != nil {
				return fmt.Errorf("Error inserting observations for atmotube %s: %v\n", atmotube.AtmotubeID, err)
			}

		}

	}

	err = tx.Commit(ctx)

	return err

}
