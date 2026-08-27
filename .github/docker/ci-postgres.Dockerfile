# CI Test Database — PostgreSQL 16 with PostGIS + pgvector
#
# Based on the official postgis/postgis image (provides PostGIS 3.4 on PG 16).
# Adds pgvector from the PGDG apt repository which is already configured
# in the base image.
#
# This image is ONLY used for CI testing. Production uses NeonDB which
# provides both extensions natively.

FROM postgis/postgis:16-3.4

# Install pgvector from the PGDG repository (already configured in base image)
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16-pgvector \
    && rm -rf /var/lib/apt/lists/*
