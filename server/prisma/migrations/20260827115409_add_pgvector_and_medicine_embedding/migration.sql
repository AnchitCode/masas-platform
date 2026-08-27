-- Phase 9.1b: Enable pgvector extension for AI embedding storage
-- Non-destructive: adds extension only if not already present
-- NeonDB supports pgvector on all plans including free tier
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- Add nullable embedding column to medicine_catalog
-- 768 dimensions matches nomic-embed-text model output
-- Nullable: medicines without embeddings still work via keyword search
-- AlterTable
ALTER TABLE "medicine_catalog" ADD COLUMN "embedding" vector(768);

-- Create HNSW index for cosine similarity search
-- Why HNSW over IVFFlat:
--   1. No separate build/training step required
--   2. Better query performance for small catalogs (<10K medicines)
--   3. Maintains recall quality as data grows
--   4. Slightly more memory, but negligible at MASAS scale
-- Only indexes rows that have an embedding (partial index)
-- Uses cosine distance operator (vector_cosine_ops) for semantic similarity
CREATE INDEX IF NOT EXISTS "idx_medicine_catalog_embedding_hnsw"
  ON "medicine_catalog"
  USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;
