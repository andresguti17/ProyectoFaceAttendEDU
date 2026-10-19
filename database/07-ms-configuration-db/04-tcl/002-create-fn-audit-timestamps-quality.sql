CREATE OR REPLACE FUNCTION quality.fn_audit_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, CURRENT_TIMESTAMP);
    NEW.updated_at := CURRENT_TIMESTAMP;
    NEW.row_version := COALESCE(NEW.row_version, 1);
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at := CURRENT_TIMESTAMP;
    NEW.row_version := OLD.row_version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
