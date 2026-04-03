
CREATE OR REPLACE FUNCTION public.vault_insert_secret(_name text, _secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO vault.secrets (name, secret)
  VALUES (_name, _secret);
END;
$$;

-- Also create a function to read decrypted secrets from vault (for encrypt/decrypt edge functions)
CREATE OR REPLACE FUNCTION public.vault_read_secret(_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _decrypted text;
BEGIN
  SELECT decrypted_secret INTO _decrypted
  FROM vault.decrypted_secrets
  WHERE name = _name
  LIMIT 1;
  
  RETURN _decrypted;
END;
$$;
