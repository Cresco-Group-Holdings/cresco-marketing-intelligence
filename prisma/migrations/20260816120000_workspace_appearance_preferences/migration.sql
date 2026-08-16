-- Add appearance preferences to workspace preference
ALTER TABLE "WorkspacePreference" ADD COLUMN IF NOT EXISTS "themeMode" TEXT;
ALTER TABLE "WorkspacePreference" ADD COLUMN IF NOT EXISTS "backgroundStyle" TEXT;
