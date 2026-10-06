# CI Test Database — PostgreSQL 16 with PostGIS + pgvector
#
# Uses a multi-stage build to combine PostGIS (from postgis/postgis)
# with pgvector (from pgvector/pgvector) without requiring apt-get.
#
# This image is ONLY used for CI testing. Production uses NeonDB which
# provides both extensions natively.

# Stage 1: Source pgvector extension files
FROM pgvector/pgvector:0.8.0-pg16 AS pgvector-source

# Stage 2: PostGIS base with pgvector copied in
FROM postgis/postgis:16-3.4

# Copy pgvector shared library and extension metadata from the pgvector image
COPY --from=pgvector-source /usr/lib/postgresql/16/lib/vector.so /usr/lib/postgresql/16/lib/vector.so
COPY --from=pgvector-source /usr/share/postgresql/16/extension/vector* /usr/share/postgresql/16/extension/
