CREATE TABLE "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"messages" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_session_id_unique" UNIQUE("session_id")
);
