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

func main() {

	connectionString := os.Getenv("PIPELINE_CONNECTION_STRING")
	ctx := context.Background()

	conn, err := pgx.Connect(ctx, connectionString)

	if err != nil {
		panic(err)
	}

	defer conn.Close(ctx)

	queries := db.New(conn)

	atmotubes, err := queries.ListAtmotubes(ctx)

	if err != nil {
		panic(err)
	}

	fmt.Printf("Fetched %d atmotubes\n", len(atmotubes))

	for _, atmotubeDevice := range atmotubes {
		fmt.Printf("Working on atmotube %s\n", atmotubeDevice.AtmotubeID)

		endTime := time.Now()
		startTime := endTime.AddDate(0, 0, -6)

		extracted, err := atmotube.Extract(ctx, client, atmotubeDevice.AtmotubeID, atmotubeDevice.ApiKey, startTime, endTime)

		if err != nil {
			log.Fatalf("extracting error: %v", err)
		}

		err = atmotube.Load(atmotubeDevice, extracted, ctx, queries, conn)

		if err != nil {
			log.Fatalf("loading error: %v", err)
		}

	}

}
