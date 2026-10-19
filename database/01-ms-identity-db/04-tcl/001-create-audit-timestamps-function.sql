CREATE OR REPLACE FUNCTION identity.fn_audit_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, NOW());
    NEW.updated_at := COALESCE(NEW.updated_at, NOW());
    NEW.row_version := COALESCE(NEW.row_version, 1);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at := NOW();
    NEW.row_version := OLD.row_version + 1;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;
