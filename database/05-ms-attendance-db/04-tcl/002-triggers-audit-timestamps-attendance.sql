CREATE OR REPLACE FUNCTION attendance.fn_audit_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at = COALESCE(NEW.created_at, now());
    NEW.row_version = COALESCE(NEW.row_version, 1);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at = now();
    NEW.row_version = COALESCE(NEW.row_version, 1) + 1;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
