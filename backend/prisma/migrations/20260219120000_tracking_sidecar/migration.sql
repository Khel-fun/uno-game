CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id int NOT NULL,
  game_id text NOT NULL,
  room_id text NOT NULL,
  owner_address text NOT NULL,
  is_private boolean NOT NULL DEFAULT false,
  game_code_hash text NULL,
  status text NOT NULL CHECK (status IN ('not_started','started','ended')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, game_id),
  UNIQUE (room_id)
);

CREATE TABLE IF NOT EXISTS zk_circuit_setup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_name text NOT NULL CHECK (circuit_name IN ('shuffle','deal','draw','play')),
  proof_system text NOT NULL DEFAULT 'ultrahonk',
  compiled_circuit_json jsonb NOT NULL,
  artifact_sha256 text NOT NULL,
  noir_version text NULL,
  circuit_hash text NULL,
  verification_key_hex text NOT NULL,
  vk_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (circuit_name, artifact_sha256)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_zk_circuit_setup_active_unique
ON zk_circuit_setup (circuit_name)
WHERE is_active = true;

CREATE TABLE IF NOT EXISTS proof_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id int NOT NULL,
  game_id text NOT NULL,
  room_id text NOT NULL,
  circuit_name text NOT NULL CHECK (circuit_name IN ('shuffle','deal','draw','play')),
  circuit_setup_id uuid NOT NULL REFERENCES zk_circuit_setup(id),
  player_address text NULL,
  proof_hex text NOT NULL,
  proof_hash text NOT NULL,
  public_inputs_json jsonb NOT NULL,
  local_verified boolean NULL,
  kurier_job_id text NULL,
  kurier_status text NULL,
  aggregation_id numeric NULL,
  domain_id numeric NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proof_records_chain_game ON proof_records(chain_id, game_id);
CREATE INDEX IF NOT EXISTS idx_proof_records_room_id ON proof_records(room_id);
CREATE INDEX IF NOT EXISTS idx_proof_records_kurier_job_id ON proof_records(kurier_job_id);
CREATE INDEX IF NOT EXISTS idx_proof_records_aggregation_id ON proof_records(aggregation_id);

CREATE TABLE IF NOT EXISTS aggregation_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_record_id uuid NOT NULL REFERENCES proof_records(id),
  zkverify_contract_address text NOT NULL,
  domain_id numeric NOT NULL,
  aggregation_id numeric NOT NULL,
  leaf text NOT NULL,
  merkle_path_json jsonb NOT NULL,
  leaf_count numeric NOT NULL,
  leaf_index numeric NOT NULL,
  verified boolean NULL,
  tx_hash text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (proof_record_id, domain_id, aggregation_id)
);

CREATE INDEX IF NOT EXISTS idx_aggregation_verifications_domain_agg
ON aggregation_verifications(domain_id, aggregation_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_game_sessions_updated_at ON game_sessions;
CREATE TRIGGER trg_game_sessions_updated_at
BEFORE UPDATE ON game_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_proof_records_updated_at ON proof_records;
CREATE TRIGGER trg_proof_records_updated_at
BEFORE UPDATE ON proof_records
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_aggregation_verifications_updated_at ON aggregation_verifications;
CREATE TRIGGER trg_aggregation_verifications_updated_at
BEFORE UPDATE ON aggregation_verifications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
