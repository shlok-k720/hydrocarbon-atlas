-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TopicStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "namingAttempts" INTEGER NOT NULL DEFAULT 0,
    "namingCorrect" INTEGER NOT NULL DEFAULT 0,
    "drawingAttempts" INTEGER NOT NULL DEFAULT 0,
    "drawingCorrect" INTEGER NOT NULL DEFAULT 0,
    "miscAttempts" INTEGER NOT NULL DEFAULT 0,
    "miscCorrect" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TopicStat_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "LearnerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TopicStat" ("drawingAttempts", "drawingCorrect", "id", "namingAttempts", "namingCorrect", "profileId", "topic", "updatedAt") SELECT "drawingAttempts", "drawingCorrect", "id", "namingAttempts", "namingCorrect", "profileId", "topic", "updatedAt" FROM "TopicStat";
DROP TABLE "TopicStat";
ALTER TABLE "new_TopicStat" RENAME TO "TopicStat";
CREATE UNIQUE INDEX "TopicStat_profileId_topic_key" ON "TopicStat"("profileId", "topic");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
