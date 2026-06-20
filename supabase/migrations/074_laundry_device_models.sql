-- 074: modelos de dispositivos smart gerenciáveis pela UI

CREATE TABLE laundry_device_models (
  id                text PRIMARY KEY,
  organization_id   uuid REFERENCES organizations(id) ON DELETE CASCADE,
  brand             text NOT NULL,
  model             text NOT NULL,
  label             text NOT NULL,
  start_url_template text NOT NULL,
  stop_url_template  text NOT NULL,
  status_url_template text NOT NULL,
  setup_instructions text,
  is_global         boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX laundry_device_models_org_idx ON laundry_device_models (organization_id);
CREATE INDEX laundry_device_models_brand_idx ON laundry_device_models (brand);

ALTER TABLE laundry_device_models ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'laundry_device_models' AND policyname = 'laundry_device_models read'
  ) THEN
    CREATE POLICY "laundry_device_models read" ON laundry_device_models
      FOR SELECT USING (is_global = true OR organization_id IS NULL OR
        is_superadmin() OR
        EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = laundry_device_models.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','hospitalidade'])
        ) OR user_supervises_organization(organization_id)
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'laundry_device_models' AND policyname = 'laundry_device_models manage'
  ) THEN
    CREATE POLICY "laundry_device_models manage" ON laundry_device_models
      FOR ALL USING (
        is_superadmin() OR
        EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = laundry_device_models.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','hospitalidade'])
        ) OR user_supervises_organization(organization_id)
      )
      WITH CHECK (
        is_superadmin() OR
        EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = laundry_device_models.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','hospitalidade'])
        ) OR user_supervises_organization(organization_id)
      );
  END IF;
END $$;

-- ── Seed: modelos globais pré-cadastrados ──────────────────────────────────

INSERT INTO laundry_device_models (id, organization_id, brand, model, label, start_url_template, stop_url_template, status_url_template, setup_instructions, is_global) VALUES

-- Shelly Gen1
('shelly_1pm', NULL, 'Shelly', '1PM', 'Shelly 1PM',
 'http://{ip}/relay/0?turn=on&timer={seconds}',
 'http://{ip}/relay/0?turn=off',
 'http://{ip}/status',
 '1. Baixe o app **Shelly Smart Control** (iOS/Android)
2. Ligue o Shelly na tomada — ele cria uma rede WiFi "Shelly1PM-XXXX"
3. Conecte seu celular nessa rede
4. No app, adicione o dispositivo e conecte ao WiFi da base
5. Anote o **IP** que aparece no app (ex: 192.168.1.105)
6. No roteador, fixe o IP (DHCP reservation) para que nunca mude
7. Instalação elétrica: L (fase entrada) → Shelly → O (fase saída) → Máquina', true),

('shelly_1', NULL, 'Shelly', '1 (sem medidor)', 'Shelly 1',
 'http://{ip}/relay/0?turn=on&timer={seconds}',
 'http://{ip}/relay/0?turn=off',
 'http://{ip}/status',
 '1. Baixe o app **Shelly Smart Control**
2. Ligue o Shelly — conecte ao WiFi da base pelo app
3. Anote o IP e fixe no roteador
4. Instalação elétrica: L → Shelly → O → Máquina', true),

('shelly_25', NULL, 'Shelly', '2.5 (2 canais)', 'Shelly 2.5',
 'http://{ip}/relay/0?turn=on&timer={seconds}',
 'http://{ip}/relay/0?turn=off',
 'http://{ip}/status',
 '1. Mesmo processo do Shelly 1PM
2. O canal 0 controla a primeira saída
3. Se usar 2 máquinas no mesmo Shelly, cadastre cada uma com canal diferente', true),

('shelly_plug_s', NULL, 'Shelly', 'Plug S (tomada)', 'Shelly Plug S',
 'http://{ip}/relay/0?turn=on&timer={seconds}',
 'http://{ip}/relay/0?turn=off',
 'http://{ip}/status',
 '1. Plugue o Shelly Plug S na tomada
2. Configure o WiFi pelo app Shelly
3. Conecte a máquina de lavar no Plug S
4. Anote o IP e fixe no roteador', true),

-- Shelly Gen2/Gen3/Gen4 (RPC API)
('shelly_plus_1pm', NULL, 'Shelly', 'Plus 1PM (Gen2)', 'Shelly Plus 1PM',
 'http://{ip}/rpc/Switch.Set?id=0&on=true&toggle_after={seconds}',
 'http://{ip}/rpc/Switch.Set?id=0&on=false',
 'http://{ip}/rpc/Switch.GetStatus?id=0',
 '1. Baixe o app **Shelly Smart Control**
2. Ligue o Shelly Plus — ele cria rede "ShellyPlus1PM-XXXX"
3. Configure WiFi pelo app
4. Anote o IP e fixe no roteador
5. Instalação: L → Shelly → O → Máquina', true),

('shelly_1pm_gen3', NULL, 'Shelly', '1PM Gen3', 'Shelly 1PM Gen3',
 'http://{ip}/rpc/Switch.Set?id=0&on=true&toggle_after={seconds}',
 'http://{ip}/rpc/Switch.Set?id=0&on=false',
 'http://{ip}/rpc/Switch.GetStatus?id=0',
 '1. Mesmo processo do Shelly Plus 1PM
2. Gen3 suporta WiFi, Bluetooth e Matter
3. Configure pelo app Shelly e anote o IP', true),

('shelly_1pm_gen4', NULL, 'Shelly', '1PM Gen4', 'Shelly 1PM Gen4',
 'http://{ip}/rpc/Switch.Set?id=0&on=true&toggle_after={seconds}',
 'http://{ip}/rpc/Switch.Set?id=0&on=false',
 'http://{ip}/rpc/Switch.GetStatus?id=0',
 '1. Mesmo processo do Shelly Plus 1PM
2. Gen4 suporta WiFi, Bluetooth, Zigbee e Matter
3. Configure pelo app Shelly e anote o IP', true),

('shelly_plus_plug_s', NULL, 'Shelly', 'Plus Plug S (Gen2)', 'Shelly Plus Plug S',
 'http://{ip}/rpc/Switch.Set?id=0&on=true&toggle_after={seconds}',
 'http://{ip}/rpc/Switch.Set?id=0&on=false',
 'http://{ip}/rpc/Switch.GetStatus?id=0',
 '1. Plugue na tomada, configure WiFi pelo app
2. Conecte a máquina no Plug S
3. Anote o IP e fixe no roteador', true),

('shelly_pro_1pm', NULL, 'Shelly', 'Pro 1PM (DIN rail)', 'Shelly Pro 1PM',
 'http://{ip}/rpc/Switch.Set?id=0&on=true&toggle_after={seconds}',
 'http://{ip}/rpc/Switch.Set?id=0&on=false',
 'http://{ip}/rpc/Switch.GetStatus?id=0',
 '1. Instale no trilho DIN do quadro elétrico
2. Configure WiFi pelo app ou interface web
3. Anote o IP e fixe no roteador', true),

-- Sonoff com Tasmota
('sonoff_basic_tasmota', NULL, 'Sonoff (Tasmota)', 'Basic R2/R3', 'Sonoff Basic (Tasmota)',
 'http://{ip}/cm?cmnd=Backlog%20Power%20On%3BRuleTimer1%20{seconds}',
 'http://{ip}/cm?cmnd=Power%20Off',
 'http://{ip}/cm?cmnd=Status%200',
 '1. Flash o firmware Tasmota no Sonoff Basic (via serial ou OTA)
2. Conecte ao WiFi "tasmota-XXXX" e configure sua rede
3. Acesse a interface web do Tasmota e configure:
   - Console → `Rule1 ON Rules#Timer=1 DO Power Off ENDON`
   - Console → `Rule1 1`
4. Anote o IP e fixe no roteador', true),

('sonoff_mini_tasmota', NULL, 'Sonoff (Tasmota)', 'Mini R2/R3/R4', 'Sonoff Mini (Tasmota)',
 'http://{ip}/cm?cmnd=Backlog%20Power%20On%3BRuleTimer1%20{seconds}',
 'http://{ip}/cm?cmnd=Power%20Off',
 'http://{ip}/cm?cmnd=Status%200',
 '1. Flash Tasmota no Sonoff Mini (DIY mode ou serial)
2. Configure WiFi pela interface Tasmota
3. Configure a regra de timer (mesmo do Basic)
4. Anote o IP e fixe no roteador', true),

('sonoff_pow_tasmota', NULL, 'Sonoff (Tasmota)', 'POW R2/R3 (com medidor)', 'Sonoff POW (Tasmota)',
 'http://{ip}/cm?cmnd=Backlog%20Power%20On%3BRuleTimer1%20{seconds}',
 'http://{ip}/cm?cmnd=Power%20Off',
 'http://{ip}/cm?cmnd=Status%200',
 '1. Flash Tasmota no Sonoff POW (via serial)
2. O POW inclui medição de energia (voltagem, corrente, potência)
3. Configure WiFi e regra de timer
4. Anote o IP e fixe no roteador', true),

('sonoff_s31_tasmota', NULL, 'Sonoff (Tasmota)', 'S31 Plug', 'Sonoff S31 Plug (Tasmota)',
 'http://{ip}/cm?cmnd=Backlog%20Power%20On%3BRuleTimer1%20{seconds}',
 'http://{ip}/cm?cmnd=Power%20Off',
 'http://{ip}/cm?cmnd=Status%200',
 '1. Flash Tasmota no S31 (via serial)
2. Plugue na tomada, configure WiFi
3. Configure regra de timer
4. Conecte a máquina no S31', true),

-- Tuya / Smart Life
('tuya_plug_tasmota', NULL, 'Tuya / Smart Life', 'Smart Plug (Tasmota)', 'Tuya Smart Plug (Tasmota)',
 'http://{ip}/cm?cmnd=Backlog%20Power%20On%3BRuleTimer1%20{seconds}',
 'http://{ip}/cm?cmnd=Power%20Off',
 'http://{ip}/cm?cmnd=Status%200',
 '1. Flash Tasmota usando **tuya-convert** (OTA, sem abrir o dispositivo)
   - Ou via serial se tuya-convert não funcionar
2. Conecte ao WiFi "tasmota-XXXX"
3. Configure sua rede WiFi
4. Configure a regra de timer no Console:
   - `Rule1 ON Rules#Timer=1 DO Power Off ENDON`
   - `Rule1 1`
5. Anote o IP e fixe no roteador', true),

('tuya_switch_tasmota', NULL, 'Tuya / Smart Life', 'Smart Switch (Tasmota)', 'Tuya Smart Switch (Tasmota)',
 'http://{ip}/cm?cmnd=Backlog%20Power%20On%3BRuleTimer1%20{seconds}',
 'http://{ip}/cm?cmnd=Power%20Off',
 'http://{ip}/cm?cmnd=Status%200',
 '1. Flash Tasmota via tuya-convert ou serial
2. Configure WiFi e regra de timer
3. Anote o IP e fixe no roteador', true),

('tuya_relay_tasmota', NULL, 'Tuya / Smart Life', 'Relé/Módulo (Tasmota)', 'Tuya Relé (Tasmota)',
 'http://{ip}/cm?cmnd=Backlog%20Power%20On%3BRuleTimer1%20{seconds}',
 'http://{ip}/cm?cmnd=Power%20Off',
 'http://{ip}/cm?cmnd=Status%200',
 '1. Flash Tasmota via serial (necessita soldar pinos)
2. Configure WiFi e regra de timer
3. Instalação: L → Relé → Saída → Máquina', true),

-- Positivo
('positivo_plug_tasmota', NULL, 'Positivo Casa Inteligente', 'Smart Plug Wi-Fi (Tasmota)', 'Positivo Smart Plug (Tasmota)',
 'http://{ip}/cm?cmnd=Backlog%20Power%20On%3BRuleTimer1%20{seconds}',
 'http://{ip}/cm?cmnd=Power%20Off',
 'http://{ip}/cm?cmnd=Status%200',
 '1. Positivo usa chip Tuya — flash via tuya-convert
2. Configure WiFi e regra de timer
3. Plugue a máquina no Smart Plug', true),

-- Intelbras IZY
('intelbras_plug_tasmota', NULL, 'Intelbras IZY', 'Smart Plug Wi-Fi (Tasmota)', 'Intelbras IZY Plug (Tasmota)',
 'http://{ip}/cm?cmnd=Backlog%20Power%20On%3BRuleTimer1%20{seconds}',
 'http://{ip}/cm?cmnd=Power%20Off',
 'http://{ip}/cm?cmnd=Status%200',
 '1. Intelbras IZY usa chip Tuya — flash via tuya-convert
2. Configure WiFi e regra de timer
3. Plugue a máquina no Smart Plug', true),

-- Ekaza
('ekaza_plug_tasmota', NULL, 'Ekaza', 'Smart Plug (Tasmota)', 'Ekaza Smart Plug (Tasmota)',
 'http://{ip}/cm?cmnd=Backlog%20Power%20On%3BRuleTimer1%20{seconds}',
 'http://{ip}/cm?cmnd=Power%20Off',
 'http://{ip}/cm?cmnd=Status%200',
 '1. Flash Tasmota via tuya-convert ou serial
2. Configure WiFi e regra de timer', true),

-- Genéricos
('tasmota_generic', NULL, 'Tasmota (genérico)', 'Qualquer dispositivo', 'Outro dispositivo com Tasmota',
 'http://{ip}/cm?cmnd=Backlog%20Power%20On%3BRuleTimer1%20{seconds}',
 'http://{ip}/cm?cmnd=Power%20Off',
 'http://{ip}/cm?cmnd=Status%200',
 '1. Flash Tasmota no dispositivo (serial ou OTA)
2. Configure WiFi
3. Configure regra de timer no Console:
   - `Rule1 ON Rules#Timer=1 DO Power Off ENDON`
   - `Rule1 1`
4. Anote o IP e fixe no roteador', true),

('custom_http_relay', NULL, 'Outro (HTTP)', 'Relé HTTP customizado', 'Relé HTTP customizado',
 'http://{ip}/relay/0?turn=on&timer={seconds}',
 'http://{ip}/relay/0?turn=off',
 'http://{ip}/status',
 '1. Configure o dispositivo na rede WiFi
2. Os templates de URL usam {ip} e {seconds} como variáveis
3. Edite os templates se o seu dispositivo usar URLs diferentes
4. Anote o IP e fixe no roteador', true)

ON CONFLICT (id) DO NOTHING;
