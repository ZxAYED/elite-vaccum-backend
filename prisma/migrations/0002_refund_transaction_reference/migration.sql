-- Store the Stripe refund id (re_...) so a refund row can be reconciled
-- against Stripe. Null when the money was returned offline (e.g. a cash
-- refund on a COD order).
ALTER TABLE "refunds" ADD COLUMN "transaction_reference" VARCHAR(255);

CREATE UNIQUE INDEX "refunds_transaction_reference_key"
  ON "refunds"("transaction_reference");
