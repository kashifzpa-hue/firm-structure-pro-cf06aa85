ALTER TABLE public.bank_account_documents 
ADD COLUMN is_encrypted boolean NOT NULL DEFAULT false,
ADD COLUMN iv text,
ADD COLUMN encryption_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.movement_documents
ADD COLUMN is_encrypted boolean NOT NULL DEFAULT false,
ADD COLUMN iv text,
ADD COLUMN encryption_version integer NOT NULL DEFAULT 1;