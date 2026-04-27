package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"omnihub/pipelines/db"
	"omnihub/pipelines/sources/atmotube"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var client = &http.Client{
	Timeout: 30 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        100,
		IdleConnTimeout:     90 * time.Second,
		MaxConnsPerHost:     10,
		TLSHandshakeTimeout: 10 * time.Second,
	},
}

func LogDB(name string, message string, queries *db.Queries, ctx context.Context) {

	queries.ExecutionLog(ctx, db.ExecutionLogParams{
		Name: name,
		Datetime: pgtype.Timestamptz{
			Time:  time.Now(),
			Valid: true,
		},
		Value: fmt.Appendf(nil, `{"message": "%s"}`, message),
	})

}

func execute(connectionString string, ctx context.Context) {
	conn, err := pgx.Connect(ctx, connectionString)

	if err != nil {
		panic(err)
	}

	defer conn.Close(ctx)

	queries := db.New(conn)

	LogDB("EXECUTION_STARTED", "Execution started", queries, ctx)

	atmotubes, err := queries.ListAtmotubes(ctx)

	if err != nil {
		LogDB("DB_ERROR", fmt.Sprintf("Couldn't load atmotubes: %v", err), queries, ctx)
		panic(err)
	}

	fmt.Printf("Fetched %d atmotubes\n", len(atmotubes))

	for _, atmotubeDevice := range atmotubes {
		fmt.Printf("Working on atmotube %s\n", atmotubeDevice.AtmotubeID)

		endTime := time.Now()
		startTime := endTime.AddDate(0, 0, -6)

		extracted, err := atmotube.Extract(ctx, client, atmotubeDevice.AtmotubeID, atmotubeDevice.ApiKey, startTime, endTime)

		if err != nil {
			LogDB("ERROR", fmt.Sprintf("Couldn't extract atmotubes: %v", err), queries, ctx)
			log.Fatalf("extracting error: %v", err)
		}

		err = atmotube.Load(atmotubeDevice, extracted, ctx, queries, conn)

		if err != nil {
			LogDB("ERROR", fmt.Sprintf("Couldn't load atmotubes: %v", err), queries, ctx)
			log.Fatalf("loading error: %v", err)
		}

	}

	LogDB("EXECUTION_ENDED", "", queries, ctx)

}

func main() {

	connectionString := os.Getenv("PIPELINE_CONNECTION_STRING")
	ctx := context.Background()

	time.Sleep(10 * time.Minute)

	for true {
		execute(connectionString, ctx)
		time.Sleep(time.Hour * 1)
	}

}
