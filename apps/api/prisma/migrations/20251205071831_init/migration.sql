-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "isAccepted" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "projects_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assigneeId" TEXT,
    "estimatedHours" REAL,
    "actualHours" REAL,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_slug_idx" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspace_members_workspaceId_idx" ON "workspace_members"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_members_userId_idx" ON "workspace_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "projects_workspaceId_idx" ON "projects"("workspaceId");

-- CreateIndex
CREATE INDEX "projects_createdById_idx" ON "projects"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "projects_workspaceId_key_key" ON "projects"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");

-- CreateIndex
CREATE INDEX "tasks_assigneeId_idx" ON "tasks"("assigneeId");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_dueDate_idx" ON "tasks"("dueDate");

-- CreateIndex
CREATE INDEX "comments_taskId_idx" ON "comments"("taskId");

-- CreateIndex
CREATE INDEX "comments_userId_idx" ON "comments"("userId");
