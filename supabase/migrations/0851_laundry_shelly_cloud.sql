-- 085: conexão via Shelly Cloud — permite controlar máquinas de qualquer rede
-- (o IP local só funciona quando o servidor está na mesma rede do dispositivo)

ALTER TABLE laundry_machines
  ADD COLUMN IF NOT EXISTS connection_mode text NOT NULL DEFAULT 'local'
    CHECK (connection_mode IN ('local','cloud')),
  ADD COLUMN IF NOT EXISTS cloud_server    text,
  ADD COLUMN IF NOT EXISTS cloud_device_id text,
  ADD COLUMN IF NOT EXISTS cloud_auth_key  text;

COMMENT ON COLUMN laundry_machines.connection_mode IS 'local = IP na mesma rede do servidor; cloud = Shelly Cloud API (funciona de qualquer lugar)';
COMMENT ON COLUMN laundry_machines.cloud_server    IS 'Server URI da conta Shelly, ex: https://shelly-151-eu.shelly.cloud';
COMMENT ON COLUMN laundry_machines.cloud_device_id IS 'Device ID hexadecimal do dispositivo (sem dois-pontos)';
COMMENT ON COLUMN laundry_machines.cloud_auth_key  IS 'Authorization cloud key da conta Shelly';
