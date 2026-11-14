ALTER TABLE "Preorder" ADD COLUMN "quota" INTEGER;
ALTER TABLE "Menu" ADD COLUMN "quota" INTEGER;
ALTER TABLE "Preorder" ADD CONSTRAINT "Preorder_quota_nonnegative" CHECK ("quota" IS NULL OR "quota" >= 0);
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_quota_nonnegative" CHECK ("quota" IS NULL OR "quota" >= 0);
CREATE INDEX "Order_preorderId_status_idx" ON "Order"("preorderId", "status");
