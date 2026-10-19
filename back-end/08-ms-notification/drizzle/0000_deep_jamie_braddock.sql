CREATE SCHEMA "notification";
--> statement-breakpoint
CREATE TABLE "notification"."alert" (
	"alert_id" bigserial PRIMARY KEY NOT NULL,
	"academic_actor_id" bigint NOT NULL,
	"alert_type_id" smallint NOT NULL,
	"raised_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"row_version" bigint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification"."alert_type" (
	"alert_type_id" "smallserial" PRIMARY KEY NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"severity" varchar(50) DEFAULT 'INFO' NOT NULL,
	"channel" varchar(50) DEFAULT 'IN_APP' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"row_version" bigint DEFAULT 1 NOT NULL,
	CONSTRAINT "alert_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "notification"."alert" ADD CONSTRAINT "alert_alert_type_id_alert_type_alert_type_id_fk" FOREIGN KEY ("alert_type_id") REFERENCES "notification"."alert_type"("alert_type_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_alert_actor" ON "notification"."alert" ("academic_actor_id");
--> statement-breakpoint
CREATE INDEX "idx_alert_type" ON "notification"."alert" ("alert_type_id");
--> statement-breakpoint
INSERT INTO "notification"."alert_type" (code, name, severity, channel)
VALUES
  ('ABSENCE_THRESHOLD', 'Absence threshold reached', 'WARNING', 'IN_APP'),
  ('SCHEDULE_CONFLICT', 'Schedule conflict detected', 'WARNING', 'IN_APP')
ON CONFLICT (code) DO NOTHING;