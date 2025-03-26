-- Create notifications table
CREATE TABLE IF NOT EXISTS supervisor_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id uuid NOT NULL,
  request_id uuid NOT NULL,
  request_type text NOT NULL,
  employee_name text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT request_type_check CHECK (request_type IN ('time', 'planner'))
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_supervisor_notifications_supervisor_id 
ON supervisor_notifications(supervisor_id);

CREATE INDEX IF NOT EXISTS idx_supervisor_notifications_created_at 
ON supervisor_notifications(created_at);

-- Function to create notifications for supervisors
CREATE OR REPLACE FUNCTION create_supervisor_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_employee_name text;
  v_work_centers text[];
  v_request_type text;
  v_supervisor record;
BEGIN
  -- Get employee information
  SELECT fiscal_name, work_centers INTO v_employee_name, v_work_centers
  FROM employee_profiles
  WHERE id = NEW.employee_id;

  -- Set request type based on the table being modified
  IF TG_TABLE_NAME = 'time_requests' THEN
    v_request_type := 'time';
  ELSE
    v_request_type := 'planner';
  END IF;

  -- Create notifications for each supervisor that oversees the employee's work centers
  FOR v_supervisor IN
    SELECT DISTINCT sp.id, sp.email
    FROM supervisor_profiles sp
    WHERE sp.supervisor_type = 'center'
    AND sp.is_active = true
    AND EXISTS (
      SELECT 1
      FROM unnest(sp.work_centers) sw
      WHERE sw = ANY(v_work_centers)
    )
  LOOP
    INSERT INTO supervisor_notifications (
      supervisor_id,
      request_id,
      request_type,
      employee_name,
      message
    ) VALUES (
      v_supervisor.id,
      NEW.id,
      v_request_type,
      v_employee_name,
      CASE
        WHEN v_request_type = 'time' THEN
          format('Nueva solicitud de fichaje de %s', v_employee_name)
        ELSE
          format('Nueva solicitud de planificación de %s', v_employee_name)
      END
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for both request types
DROP TRIGGER IF EXISTS create_notifications_time_requests ON time_requests;
CREATE TRIGGER create_notifications_time_requests
  AFTER INSERT ON time_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_supervisor_notifications();

DROP TRIGGER IF EXISTS create_notifications_planner_requests ON planner_requests;
CREATE TRIGGER create_notifications_planner_requests
  AFTER INSERT ON planner_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_supervisor_notifications();

-- Enable RLS and create policies
ALTER TABLE supervisor_notifications ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view notifications
-- This is necessary because we need to check supervisor_id against email in the application
CREATE POLICY "Allow all authenticated users to view notifications"
  ON supervisor_notifications
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to update notifications
-- This is necessary because we need to check supervisor_id against email in the application
CREATE POLICY "Allow all authenticated users to update notifications"
  ON supervisor_notifications
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions to authenticated users
GRANT SELECT, UPDATE ON supervisor_notifications TO authenticated;