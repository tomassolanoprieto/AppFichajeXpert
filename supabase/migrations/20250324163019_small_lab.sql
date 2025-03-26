/*
  # Add location columns to time_entries table

  1. Changes
    - Add latitude and longitude columns to time_entries table
    - Both columns are nullable to allow entries without location data
    - Add indexes for faster geospatial queries

  2. Notes
    - Location data is optional and will not prevent time entries from being recorded
    - Coordinates are stored as double precision for accuracy
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'time_entries' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE time_entries 
    ADD COLUMN latitude double precision,
    ADD COLUMN longitude double precision;

    CREATE INDEX idx_time_entries_location 
    ON time_entries (latitude, longitude) 
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
  END IF;
END $$;