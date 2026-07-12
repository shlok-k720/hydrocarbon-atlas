-- CreateTable
CREATE TABLE "UserAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LearnerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "browserId" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LearnerProfile" ("browserId", "createdAt", "id", "updatedAt") SELECT "browserId", "createdAt", "id", "updatedAt" FROM "LearnerProfile";
DROP TABLE "LearnerProfile";
ALTER TABLE "new_LearnerProfile" RENAME TO "LearnerProfile";
CREATE UNIQUE INDEX "LearnerProfile_browserId_key" ON "LearnerProfile"("browserId");
CREATE UNIQUE INDEX "LearnerProfile_userId_key" ON "LearnerProfile"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_username_key" ON "UserAccount"("username");
