-- CreateTable
CREATE TABLE "weekly_report_snapshots" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "week_end" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,
    "commentary" TEXT,
    "tenant_id" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "weekly_report_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_heartbeats" (
    "id" TEXT NOT NULL,
    "workflow_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_heartbeats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weekly_report_snapshots_week_start_idx" ON "weekly_report_snapshots"("week_start");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_report_snapshots_week_start_tenant_id_key" ON "weekly_report_snapshots"("week_start", "tenant_id");

-- CreateIndex
CREATE INDEX "workflow_heartbeats_workflow_key_created_at_idx" ON "workflow_heartbeats"("workflow_key", "created_at");
