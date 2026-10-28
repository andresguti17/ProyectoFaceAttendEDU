-- PostgreSQL enums used through columnDefinition; H2 has no CREATE TYPE ... AS ENUM, so a domain stands in.
-- Hibernate quotes the whole "identity.<type>" name as one identifier, hence the odd names.
CREATE SCHEMA IF NOT EXISTS "identity";
CREATE DOMAIN IF NOT EXISTS "identity"."identity.authentication_type" AS VARCHAR(20);
CREATE DOMAIN IF NOT EXISTS "identity"."identity.user_session_status" AS VARCHAR(20);
