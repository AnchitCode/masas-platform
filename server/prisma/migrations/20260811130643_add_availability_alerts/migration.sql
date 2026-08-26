-- CreateTable
CREATE TABLE "availability_alerts" (
    "id" TEXT NOT NULL,
    "saved_search_id" TEXT NOT NULL,
    "inventory_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "availability_alerts_inventory_id_idx" ON "availability_alerts"("inventory_id");

-- CreateIndex
CREATE UNIQUE INDEX "availability_alerts_saved_search_id_inventory_id_key" ON "availability_alerts"("saved_search_id", "inventory_id");

-- AddForeignKey
ALTER TABLE "availability_alerts" ADD CONSTRAINT "availability_alerts_saved_search_id_fkey" FOREIGN KEY ("saved_search_id") REFERENCES "saved_searches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_alerts" ADD CONSTRAINT "availability_alerts_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "pharmacy_inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
