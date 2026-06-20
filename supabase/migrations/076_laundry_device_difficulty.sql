-- 076: nível de dificuldade e ordem de exibição dos dispositivos

ALTER TABLE laundry_device_models
  ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'medium'
    CHECK (difficulty IN ('easy','medium','advanced')),
  ADD COLUMN IF NOT EXISTS display_order int NOT NULL DEFAULT 50;

-- Shelly: fácil (funciona de fábrica, sem flash de firmware)
UPDATE laundry_device_models SET difficulty = 'easy', display_order = 10 WHERE id = 'shelly_plug_s';
UPDATE laundry_device_models SET difficulty = 'easy', display_order = 11 WHERE id = 'shelly_plus_plug_s';
UPDATE laundry_device_models SET difficulty = 'easy', display_order = 12 WHERE id = 'shelly_1pm';
UPDATE laundry_device_models SET difficulty = 'easy', display_order = 13 WHERE id = 'shelly_plus_1pm';
UPDATE laundry_device_models SET difficulty = 'easy', display_order = 14 WHERE id = 'shelly_1pm_gen3';
UPDATE laundry_device_models SET difficulty = 'easy', display_order = 15 WHERE id = 'shelly_1pm_gen4';
UPDATE laundry_device_models SET difficulty = 'easy', display_order = 16 WHERE id = 'shelly_1';
UPDATE laundry_device_models SET difficulty = 'easy', display_order = 17 WHERE id = 'shelly_25';
UPDATE laundry_device_models SET difficulty = 'easy', display_order = 18 WHERE id = 'shelly_pro_1pm';

-- Sonoff com Tasmota: intermediário (precisa flash mas é documentado)
UPDATE laundry_device_models SET difficulty = 'medium', display_order = 30 WHERE id = 'sonoff_basic_tasmota';
UPDATE laundry_device_models SET difficulty = 'medium', display_order = 31 WHERE id = 'sonoff_mini_tasmota';
UPDATE laundry_device_models SET difficulty = 'medium', display_order = 32 WHERE id = 'sonoff_pow_tasmota';
UPDATE laundry_device_models SET difficulty = 'medium', display_order = 33 WHERE id = 'sonoff_s31_tasmota';

-- Tuya/Positivo/Intelbras/Ekaza: avançado (precisa flash + tuya-convert)
UPDATE laundry_device_models SET difficulty = 'advanced', display_order = 40 WHERE id = 'tuya_plug_tasmota';
UPDATE laundry_device_models SET difficulty = 'advanced', display_order = 41 WHERE id = 'tuya_switch_tasmota';
UPDATE laundry_device_models SET difficulty = 'advanced', display_order = 42 WHERE id = 'tuya_relay_tasmota';
UPDATE laundry_device_models SET difficulty = 'advanced', display_order = 43 WHERE id = 'positivo_plug_tasmota';
UPDATE laundry_device_models SET difficulty = 'advanced', display_order = 44 WHERE id = 'intelbras_plug_tasmota';
UPDATE laundry_device_models SET difficulty = 'advanced', display_order = 45 WHERE id = 'ekaza_plug_tasmota';

-- Genéricos: no final
UPDATE laundry_device_models SET difficulty = 'medium', display_order = 90 WHERE id = 'tasmota_generic';
UPDATE laundry_device_models SET difficulty = 'advanced', display_order = 99 WHERE id = 'custom_http_relay';
