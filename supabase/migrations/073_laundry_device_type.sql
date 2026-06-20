-- 073: tipo de dispositivo smart por máquina de lavanderia

ALTER TABLE laundry_machines
  ADD COLUMN IF NOT EXISTS device_type text DEFAULT 'shelly_1pm';
