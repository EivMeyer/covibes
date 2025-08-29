-- ColabVibe Database Initialization Script
-- This script runs when the PostgreSQL container starts for the first time

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create application user (for production use)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'colabvibe_app') THEN
        CREATE ROLE colabvibe_app WITH LOGIN PASSWORD 'app_password_change_in_production';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE colabvibe_dev TO colabvibe_app;
GRANT USAGE ON SCHEMA public TO colabvibe_app;
GRANT CREATE ON SCHEMA public TO colabvibe_app;

-- Create helpful functions for development
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'ColabVibe database initialization completed successfully';
END
$$;