-- CreateTable
CREATE TABLE "LearnerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "browserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "response" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttempt_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "LearnerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TopicStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "namingAttempts" INTEGER NOT NULL DEFAULT 0,
    "namingCorrect" INTEGER NOT NULL DEFAULT 0,
    "drawingAttempts" INTEGER NOT NULL DEFAULT 0,
    "drawingCorrect" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TopicStat_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "LearnerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LearnerProfile_browserId_key" ON "LearnerProfile"("browserId");

-- CreateIndex
CREATE INDEX "QuizAttempt_profileId_questionType_createdAt_idx" ON "QuizAttempt"("profileId", "questionType", "createdAt");

-- CreateIndex
CREATE INDEX "QuizAttempt_profileId_topic_createdAt_idx" ON "QuizAttempt"("profileId", "topic", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TopicStat_profileId_topic_key" ON "TopicStat"("profileId", "topic");
