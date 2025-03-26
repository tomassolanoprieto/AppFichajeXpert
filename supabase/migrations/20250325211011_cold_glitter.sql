/*
  # Fix Time Entry Validation

  1. Changes
    - Fix validation logic for clock_out entries
    - Properly handle is_active flag
    - Improve entry sequence validation
    - Add better error messages

  2. Notes
    - Maintains same basic validation rules but fixes active status handling
    - Ensures proper entry sequence validation
    - Fixes issue with clock_out entries being marked as inactive
*/

CREATE OR REPLACE FUNCTION validate_time_entry()
RETURNS TRIGGER AS $$
DECLARE
  last_entry RECORD;
  active_entry RECORD;
BEGIN
  -- Validate entry type
  IF NEW.entry_type NOT IN ('clock_in', 'break_start', 'break_end', 'clock_out') THEN
    RAISE EXCEPTION 'Tipo de entrada no válido';
  END IF;

  -- Get the active entry for this employee
  SELECT * INTO active_entry
  FROM time_entries
  WHERE employee_id = NEW.employee_id
    AND is_active = true
  ORDER BY timestamp DESC
  LIMIT 1;

  -- Get the last entry regardless of active status
  SELECT * INTO last_entry
  FROM time_entries
  WHERE employee_id = NEW.employee_id
    AND timestamp < NEW.timestamp
  ORDER BY timestamp DESC
  LIMIT 1;

  -- First entry validation
  IF last_entry IS NULL AND NEW.entry_type != 'clock_in' THEN
    RAISE EXCEPTION 'La primera entrada del día debe ser de tipo clock_in';
  END IF;

  -- Entry sequence validation
  IF last_entry IS NOT NULL THEN
    -- Clock in validation
    IF NEW.entry_type = 'clock_in' THEN
      IF active_entry IS NOT NULL THEN
        RAISE EXCEPTION 'No puedes registrar una entrada si ya hay una activa';
      END IF;
    
    -- Break start validation
    ELSIF NEW.entry_type = 'break_start' THEN
      IF active_entry IS NULL OR active_entry.entry_type NOT IN ('clock_in', 'break_end') THEN
        RAISE EXCEPTION 'No puedes iniciar una pausa sin una entrada activa';
      END IF;
    
    -- Break end validation
    ELSIF NEW.entry_type = 'break_end' THEN
      IF active_entry IS NULL OR active_entry.entry_type != 'break_start' THEN
        RAISE EXCEPTION 'No puedes finalizar una pausa sin haberla iniciado';
      END IF;
    
    -- Clock out validation
    ELSIF NEW.entry_type = 'clock_out' THEN
      IF active_entry IS NULL THEN
        RAISE EXCEPTION 'No puedes registrar una salida sin una entrada activa';
      ELSIF active_entry.entry_type = 'break_start' THEN
        RAISE EXCEPTION 'No puedes registrar una salida durante una pausa';
      END IF;
    END IF;
  END IF;

  -- Set is_active flag based on entry type
  NEW.is_active := CASE
    WHEN NEW.entry_type = 'clock_out' THEN false
    ELSE true
  END;

  -- Deactivate previous active entry if it exists
  IF active_entry IS NOT NULL THEN
    UPDATE time_entries
    SET is_active = false
    WHERE id = active_entry.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;