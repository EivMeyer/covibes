-- First, let me create a migration file to add the UserLayoutPreference model to the schema
-- This will be converted to a proper Prisma migration

-- Create user_layout_preferences table
CREATE TABLE user_layout_preferences (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    layout_type TEXT NOT NULL DEFAULT 'dashboard',
    layout_data JSONB NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_user_layout_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_layout_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Unique constraint to ensure one layout per user per team per type
    CONSTRAINT uq_user_team_layout_type UNIQUE (user_id, team_id, layout_type)
);

-- Create indexes for better query performance
CREATE INDEX idx_user_layout_user_id ON user_layout_preferences(user_id);
CREATE INDEX idx_user_layout_team_id ON user_layout_preferences(team_id);
CREATE INDEX idx_user_layout_composite ON user_layout_preferences(user_id, team_id, layout_type);