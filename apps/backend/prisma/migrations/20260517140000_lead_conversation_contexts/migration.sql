-- CreateTable
CREATE TABLE "lead_conversation_contexts" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lead_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "topics" JSONB,
    "raw_excerpt" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "s11_action" TEXT,
    "external_message_id" TEXT,

    CONSTRAINT "lead_conversation_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_conversation_contexts_lead_id_created_at_idx" ON "lead_conversation_contexts"("lead_id", "created_at");

-- AddForeignKey
ALTER TABLE "lead_conversation_contexts" ADD CONSTRAINT "lead_conversation_contexts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
