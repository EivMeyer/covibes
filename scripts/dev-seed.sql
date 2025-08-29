-- Development Seed Data for ColabVibe
-- This script adds sample data for development and testing

-- Note: This will be run after Prisma migrations in actual development
-- For now, we'll just prepare some helper functions

-- Function to generate test data
CREATE OR REPLACE FUNCTION generate_test_team(team_name TEXT DEFAULT 'TestTeam')
RETURNS TEXT AS $$
DECLARE
    team_id TEXT;
BEGIN
    -- This will be implemented after the actual schema is created by Prisma
    RAISE NOTICE 'Test data generation prepared for team: %', team_name;
    RETURN team_name || '_placeholder';
END;
$$ language 'plpgsql';

-- Log seed completion
DO $$
BEGIN
    RAISE NOTICE 'Development seed data preparation completed';
END
$$;