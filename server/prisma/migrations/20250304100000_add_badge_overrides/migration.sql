-- CreateTable
CREATE TABLE "badge_overrides" (
    "id" TEXT NOT NULL,
    "badge_id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "bg_color" TEXT,
    "icon_color" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badge_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "badge_overrides_badge_id_key" ON "badge_overrides"("badge_id");
