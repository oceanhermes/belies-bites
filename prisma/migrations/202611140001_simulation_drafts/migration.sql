CREATE TABLE "SimulationDraft" (
 "id" TEXT NOT NULL,
 "period" TEXT NOT NULL,
 "productionDate" TEXT NOT NULL,
 "variants" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SimulationDraft_pkey" PRIMARY KEY ("id")
);
