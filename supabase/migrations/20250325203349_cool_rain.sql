/*
  # Update Time Entry Validation Function

  1. Changes
    - Fix RAISE EXCEPTION syntax in CASE statements
    - Improve validation logic structure
    - Make location data optional

  2. Notes
    - Maintains same validation rules but with correct PostgreSQL syntax
    - Ensures proper entry sequence validation
*/

CREATE OR REPLACE FUNCTION validate_time_entry()
RETURNS TRIGGER AS $$
DECLARE
  last_entry_type text;
  last_entry_active boolean;
BEGIN
  -- Validate entry type
  IF NEW.entry_type NOT IN ('clock_in', 'break_start', 'break_end', 'clock_out') THEN
    RAISE EXCEPTION 'Tipo de entrada no válido';
  END IF;

  -- Get the last entry for this employee
  SELECT entry_type, is_active 
  INTO last_entry_type, last_entry_active
  FROM time_entries
  WHERE employee_id = NEW.employee_id
    AND timestamp < NEW.timestamp
  ORDER BY timestamp DESC
  LIMIT 1;

  -- First entry validation
  IF last_entry_type IS NULL AND NEW.entry_type != 'clock_in' THEN
    RAISE EXCEPTION 'La primera entrada del día debe ser de tipo clock_in';
  END IF;

  -- Entry sequence validation
  IF last_entry_type IS NOT NULL THEN
    -- Can't clock in if there's an active entry
    IF NEW.entry_type = 'clock_in' AND last_entry_active THEN
      RAISE EXCEPTION 'No puedes registrar una entrada si ya hay una activa';
    END IF;

    -- Can't start break without an active clock in
    IF NEW.entry_type = 'break_start' AND (last_entry_type = 'break_start' OR NOT last_entry_active) THEN
      RAISE EXCEPTION 'No puedes iniciar una pausa sin una entrada activa';
    END IF;

    -- Can't end break without an active break
    IF NEW.entry_type = 'break_end' AND last_entry_type != 'break_start' THEN
      RAISE EXCEPTION 'No puedes finalizar una pausa sin haberla iniciado';
    END IF;

    -- Can't clock out without an active entry or during break
    IF NEW.entry_type = 'clock_out' AND (NOT last_entry_active OR last_entry_type = 'break_start') THEN
      RAISE EXCEPTION 'No puedes registrar una salida sin una entrada activa o durante una pausa';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;