-- Auto-create schemas for all microservices (used on first postgres init)
CREATE SCHEMA IF NOT EXISTS "identity";
CREATE SCHEMA IF NOT EXISTS "authorization";
CREATE SCHEMA IF NOT EXISTS "academic";
CREATE SCHEMA IF NOT EXISTS "scheduling";
CREATE SCHEMA IF NOT EXISTS "attendance";
CREATE SCHEMA IF NOT EXISTS "configuration";
CREATE SCHEMA IF NOT EXISTS "notification";
CREATE SCHEMA IF NOT EXISTS "biometric";
