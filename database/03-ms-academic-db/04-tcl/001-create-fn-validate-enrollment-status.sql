CREATE OR REPLACE FUNCTION academic.fn_validate_enrollment_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.enrollment_status NOT IN ('Active', 'Withdrawn', 'Completed') THEN
    RAISE EXCEPTION 'Invalid enrollment_status: %. Allowed values: Active, Withdrawn, Completed', NEW.enrollment_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
