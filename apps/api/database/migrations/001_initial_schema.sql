-- ============================================================================
-- Migration: 001_initial_schema
-- Description: 협업 플랫폼 초기 스키마 생성
-- Date: 2025-12-08
-- ============================================================================

-- ============================================================================
-- Table: users
-- Description: 사용자 엔티티
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  avatarUrl TEXT,
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK(role IN ('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'MEMBER')),
  isActive INTEGER NOT NULL DEFAULT 1,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  deletedAt TEXT
);

-- Index for email lookup
CREATE INDEX idx_users_email ON users(email);

-- Index for createdAt (soft delete queries)
CREATE INDEX idx_users_createdAt ON users(createdAt);

-- ============================================================================
-- Table: workspaces
-- Description: 워크스페이스 (멀티 테넌시)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logoUrl TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for slug lookup
CREATE INDEX idx_workspaces_slug ON workspaces(slug);

-- ============================================================================
-- Table: workspace_members
-- Description: 워크스페이스 멤버십 (User ↔ Workspace 다대다 관계)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY NOT NULL,
  workspaceId TEXT NOT NULL,
  userId TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK(role IN ('OWNER', 'ADMIN', 'MEMBER', 'GUEST')),
  isAccepted INTEGER NOT NULL DEFAULT 0,
  joinedAt TEXT NOT NULL DEFAULT (datetime('now')),

  -- Foreign Keys
  FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,

  -- Unique constraint: 한 사용자는 한 워크스페이스에 한 번만 가입
  UNIQUE(workspaceId, userId)
);

-- Index for workspace lookup
CREATE INDEX idx_workspace_members_workspaceId ON workspace_members(workspaceId);

-- Index for user lookup
CREATE INDEX idx_workspace_members_userId ON workspace_members(userId);

-- ============================================================================
-- Table: projects
-- Description: 프로젝트
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  workspaceId TEXT NOT NULL,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'ARCHIVED', 'COMPLETED')),
  startDate TEXT,
  endDate TEXT,
  createdById TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),

  -- Foreign Keys
  FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (createdById) REFERENCES users(id),

  -- Unique constraint: 워크스페이스 내에서 프로젝트 키는 유일
  UNIQUE(workspaceId, key)
);

-- Index for workspace lookup
CREATE INDEX idx_projects_workspaceId ON projects(workspaceId);

-- Index for creator lookup
CREATE INDEX idx_projects_createdById ON projects(createdById);

-- ============================================================================
-- Table: tasks
-- Description: 태스크
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  projectId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'TODO' CHECK(status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED')),
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  assigneeId TEXT,
  estimatedHours REAL,
  actualHours REAL,
  dueDate TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  completedAt TEXT,

  -- Foreign Keys
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (assigneeId) REFERENCES users(id)
);

-- Index for project lookup
CREATE INDEX idx_tasks_projectId ON tasks(projectId);

-- Index for assignee lookup
CREATE INDEX idx_tasks_assigneeId ON tasks(assigneeId);

-- Index for status filtering
CREATE INDEX idx_tasks_status ON tasks(status);

-- Index for dueDate sorting
CREATE INDEX idx_tasks_dueDate ON tasks(dueDate);

-- ============================================================================
-- Table: comments
-- Description: 댓글
-- ============================================================================
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY NOT NULL,
  taskId TEXT NOT NULL,
  userId TEXT NOT NULL,
  content TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  deletedAt TEXT,

  -- Foreign Keys
  FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id)
);

-- Index for task lookup
CREATE INDEX idx_comments_taskId ON comments(taskId);

-- Index for user lookup
CREATE INDEX idx_comments_userId ON comments(userId);

-- ============================================================================
-- Triggers: updatedAt 자동 업데이트
-- ============================================================================

-- users updatedAt trigger
CREATE TRIGGER IF NOT EXISTS update_users_updatedAt
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updatedAt = datetime('now') WHERE id = NEW.id;
END;

-- workspaces updatedAt trigger
CREATE TRIGGER IF NOT EXISTS update_workspaces_updatedAt
AFTER UPDATE ON workspaces
FOR EACH ROW
BEGIN
  UPDATE workspaces SET updatedAt = datetime('now') WHERE id = NEW.id;
END;

-- projects updatedAt trigger
CREATE TRIGGER IF NOT EXISTS update_projects_updatedAt
AFTER UPDATE ON projects
FOR EACH ROW
BEGIN
  UPDATE projects SET updatedAt = datetime('now') WHERE id = NEW.id;
END;

-- tasks updatedAt trigger
CREATE TRIGGER IF NOT EXISTS update_tasks_updatedAt
AFTER UPDATE ON tasks
FOR EACH ROW
BEGIN
  UPDATE tasks SET updatedAt = datetime('now') WHERE id = NEW.id;
END;

-- comments updatedAt trigger
CREATE TRIGGER IF NOT EXISTS update_comments_updatedAt
AFTER UPDATE ON comments
FOR EACH ROW
BEGIN
  UPDATE comments SET updatedAt = datetime('now') WHERE id = NEW.id;
END;
