-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_role" TEXT,
    "pharmacy_id" TEXT,
    "target_id" TEXT,
    "target_type" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_queries" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "normalized_query" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius_km" DOUBLE PRECISION NOT NULL,
    "result_count" INTEGER NOT NULL,
    "ai_used" BOOLEAN NOT NULL DEFAULT false,
    "target_medicine_id" TEXT,
    "target_found" BOOLEAN,
    "response_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_impressions" (
    "id" TEXT NOT NULL,
    "search_query_id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "match_type" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_impressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_metrics_snapshots" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "total_skus" INTEGER NOT NULL,
    "in_stock_skus" INTEGER NOT NULL,
    "out_of_stock_skus" INTEGER NOT NULL,
    "low_stock_skus" INTEGER NOT NULL,
    "expired_skus" INTEGER NOT NULL,
    "expiring_soon_skus" INTEGER NOT NULL,
    "total_quantity" INTEGER NOT NULL,
    "avg_price" DOUBLE PRECISION NOT NULL,
    "health_score" INTEGER NOT NULL,
    "search_impressions" INTEGER NOT NULL DEFAULT 0,
    "alerts_triggered" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pharmacy_metrics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: analytics_events
CREATE INDEX "analytics_events_type_created_at_idx" ON "analytics_events"("type", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_pharmacy_id_created_at_idx" ON "analytics_events"("pharmacy_id", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events"("created_at");

-- CreateIndex: search_queries
CREATE INDEX "search_queries_created_at_idx" ON "search_queries"("created_at");

-- CreateIndex
CREATE INDEX "search_queries_target_found_created_at_idx" ON "search_queries"("target_found", "created_at");

-- CreateIndex
CREATE INDEX "search_queries_query_created_at_idx" ON "search_queries"("query", "created_at");

-- CreateIndex: search_impressions
CREATE INDEX "search_impressions_pharmacy_id_created_at_idx" ON "search_impressions"("pharmacy_id", "created_at");

-- CreateIndex
CREATE INDEX "search_impressions_medicine_id_created_at_idx" ON "search_impressions"("medicine_id", "created_at");

-- CreateIndex
CREATE INDEX "search_impressions_search_query_id_idx" ON "search_impressions"("search_query_id");

-- CreateIndex: pharmacy_metrics_snapshots
CREATE UNIQUE INDEX "pharmacy_metrics_snapshots_pharmacy_id_period_period_start_key" ON "pharmacy_metrics_snapshots"("pharmacy_id", "period", "period_start");

-- CreateIndex
CREATE INDEX "pharmacy_metrics_snapshots_pharmacy_id_period_period_start_idx" ON "pharmacy_metrics_snapshots"("pharmacy_id", "period", "period_start");

-- CreateIndex
CREATE INDEX "pharmacy_metrics_snapshots_period_start_idx" ON "pharmacy_metrics_snapshots"("period_start");

-- AddForeignKey
ALTER TABLE "search_impressions" ADD CONSTRAINT "search_impressions_search_query_id_fkey" FOREIGN KEY ("search_query_id") REFERENCES "search_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
