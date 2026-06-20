-- 075: instruções de instalação detalhadas para cada modelo de dispositivo

UPDATE laundry_device_models SET setup_instructions =
'**O que você vai precisar:**
- 1x Shelly 1PM
- Acesso ao roteador WiFi da base
- Chave de fenda pequena (para os bornes)
- Celular com o app **Shelly Smart Control** instalado

**Passo 1 — Baixar o app**
- Vá na App Store (iPhone) ou Google Play (Android)
- Busque por **"Shelly Smart Control"** e instale
- Crie uma conta gratuita no app

**Passo 2 — Ligar o Shelly pela primeira vez**
- Conecte o Shelly em qualquer tomada para energizá-lo (pode ser com um carregador ou fio provisório)
- Aguarde ~10 segundos até a luz piscar
- O Shelly vai criar uma rede WiFi própria chamada **"Shelly1PM-XXXX"**

**Passo 3 — Conectar o Shelly ao WiFi da base**
- No celular, vá em **Configurações → WiFi**
- Conecte na rede **"Shelly1PM-XXXX"** (a internet vai cair, é normal)
- Abra o app Shelly → toque em **"Adicionar dispositivo"**
- O app vai encontrar o Shelly automaticamente
- Selecione a rede WiFi da base e digite a senha
- Aguarde o Shelly se conectar (~30 segundos)
- Reconecte seu celular ao WiFi da base

**Passo 4 — Descobrir o IP do Shelly**
- No app Shelly, toque no dispositivo que acabou de adicionar
- Vá em **Configurações → Informações do dispositivo**
- Anote o **Endereço IP** (ex: `192.168.1.105`)
- Teste no navegador: abra `http://192.168.1.105` — deve aparecer a interface web do Shelly

**Passo 5 — Fixar o IP no roteador (IMPORTANTE)**
- Acesse o painel do roteador (geralmente `192.168.1.1`)
- Procure por **"DHCP Reservation"**, **"IP fixo"** ou **"Address Reservation"**
- Adicione o MAC address do Shelly (aparece no app) com o IP anotado
- Isso garante que o IP nunca mude, mesmo se o Shelly reiniciar

**Passo 6 — Instalação elétrica**
- **DESLIGUE o disjuntor** da tomada onde a máquina está conectada
- O Shelly tem 3 bornes:
  - **L** (entrada) → conecte o fio FASE que vem da tomada
  - **N** (neutro) → conecte o fio NEUTRO
  - **O** (saída) → conecte o fio que vai para a máquina de lavar
- Basicamente: Tomada → Shelly → Máquina
- Aperte bem os bornes com a chave de fenda
- Ligue o disjuntor novamente

**Passo 7 — Testar**
- No sistema SISGO, vá em **Lavanderia → Máquinas**
- Cadastre a máquina com o IP anotado
- Clique em **"Testar conexão"** — deve aparecer "Conexão OK"
- No Painel, clique **"Liberar máquina"** e veja se ela liga

**Se não funcionar:**
- Verifique se o Shelly está na mesma rede WiFi que o servidor do SISGO
- Tente acessar `http://<IP>/status` no navegador
- Se mudou de rede WiFi, refaça o Passo 3
- Se o IP mudou, refaça o Passo 5'
WHERE id = 'shelly_1pm';

UPDATE laundry_device_models SET setup_instructions =
'**O que você vai precisar:**
- 1x Shelly 1
- Acesso ao roteador WiFi da base
- Chave de fenda pequena
- Celular com o app **Shelly Smart Control**

**Passo 1 — Baixar o app**
- App Store ou Google Play → busque **"Shelly Smart Control"**
- Crie uma conta gratuita

**Passo 2 — Ligar e conectar ao WiFi**
- Energize o Shelly → ele cria uma rede WiFi **"Shelly1-XXXX"**
- Conecte o celular nessa rede
- No app → **"Adicionar dispositivo"** → selecione o WiFi da base → aguarde conexão

**Passo 3 — Descobrir e fixar o IP**
- No app → toque no dispositivo → **Configurações → Informações**
- Anote o IP (ex: `192.168.1.110`)
- No roteador, fixe esse IP (DHCP Reservation)

**Passo 4 — Instalação elétrica**
- **DESLIGUE o disjuntor**
- Bornes: **L** (fase entrada) → **O** (fase saída para a máquina) → **N** (neutro)
- Ligue o disjuntor

**Passo 5 — Testar no SISGO**
- Cadastre a máquina com o IP → clique "Testar conexão"
- O Shelly 1 é igual ao 1PM, mas **sem medidor de consumo de energia**

**Se não funcionar:**
- Verifique se está na mesma rede WiFi
- Acesse `http://<IP>/status` no navegador
- Se o IP mudou, fixe novamente no roteador'
WHERE id = 'shelly_1';

UPDATE laundry_device_models SET setup_instructions =
'**O que você vai precisar:**
- 1x Shelly 2.5
- Acesso ao roteador WiFi
- Chave de fenda pequena
- Celular com o app Shelly

**Instalação — igual ao Shelly 1PM, mas com 2 canais:**
- Siga os mesmos passos do Shelly 1PM para configurar WiFi e fixar IP
- O Shelly 2.5 tem **2 saídas independentes** (O1 e O2)
- Cada saída pode controlar uma máquina diferente

**Se usar 2 máquinas no mesmo Shelly:**
- Cadastre a **Máquina A** com o canal 0 (padrão)
- Para a **Máquina B**, o sistema usará o canal 1
- No SISGO, cadastre cada máquina separadamente com o mesmo IP

**Instalação elétrica:**
- **DESLIGUE o disjuntor**
- **L** → fase de entrada
- **O1** → saída para a máquina 1
- **O2** → saída para a máquina 2
- **N** → neutro compartilhado

**Atenção:** O Shelly 2.5 suporta no máximo **10A por canal**. Se a máquina puxa mais que isso, use um contator.'
WHERE id = 'shelly_25';

UPDATE laundry_device_models SET setup_instructions =
'**O que você vai precisar:**
- 1x Shelly Plug S
- Celular com o app **Shelly Smart Control**
- Acesso ao roteador WiFi

**Este é o modelo mais fácil de instalar — não precisa de eletricista!**

**Passo 1 — Plugar e configurar**
- Plugue o Shelly Plug S em qualquer tomada 220V
- A luz vai piscar → o Plug cria uma rede WiFi **"ShellyPlugS-XXXX"**
- No celular, conecte nessa rede
- Abra o app Shelly → **"Adicionar dispositivo"**
- Selecione o WiFi da base e aguarde

**Passo 2 — Descobrir e fixar o IP**
- No app → dispositivo → **Configurações → Informações**
- Anote o IP e fixe no roteador (DHCP Reservation)

**Passo 3 — Conectar a máquina**
- Plugue o cabo de força da máquina de lavar **no Shelly Plug S**
- Pronto! O SISGO controla quando a energia passa ou não

**Passo 4 — Cadastrar no SISGO**
- Lavanderia → Máquinas → cadastre com o IP
- Teste a conexão e libere pelo Painel

**Atenção:** O Plug S suporta até **12A / 2500W**. Verifique a potência da sua máquina. Se for maior, use o Shelly 1PM com instalação elétrica.

**Se não funcionar:**
- Verifique se o Plug está na mesma rede WiFi
- A luz azul fixa = conectado. Piscando = sem WiFi'
WHERE id = 'shelly_plug_s';

UPDATE laundry_device_models SET setup_instructions =
'**O que você vai precisar:**
- 1x Shelly Plus 1PM (geração 2)
- Acesso ao roteador WiFi
- Chave de fenda pequena
- Celular com o app **Shelly Smart Control**

**A configuração é idêntica ao Shelly 1PM original:**

**Passo 1 — App e WiFi**
- Instale o app **Shelly Smart Control** no celular
- Energize o Shelly Plus → ele cria rede **"ShellyPlus1PM-XXXX"**
- Conecte o celular nessa rede → app → Adicionar → configure o WiFi da base

**Passo 2 — IP**
- No app → dispositivo → Configurações → anote o IP
- Fixe o IP no roteador

**Passo 3 — Instalação elétrica**
- **DESLIGUE o disjuntor**
- Bornes: **L** (fase) → **O** (saída para máquina) → **N** (neutro)
- Ligue o disjuntor

**Passo 4 — SISGO**
- Cadastre a máquina com o IP → Testar conexão → Liberar pelo Painel

**Diferenças do Plus vs. original:**
- Processador mais rápido
- Bluetooth para configuração inicial (além de WiFi)
- Interface web mais moderna
- Usa API RPC (o sistema já sabe disso, não precisa configurar nada)

**Se não funcionar:**
- Tente acessar `http://<IP>/rpc/Shelly.GetStatus` no navegador
- Verifique se está na mesma rede WiFi'
WHERE id = 'shelly_plus_1pm';

UPDATE laundry_device_models SET setup_instructions =
'**O que você vai precisar:**
- 1x Shelly 1PM Gen3
- Acesso ao roteador WiFi
- Chave de fenda pequena
- Celular com o app **Shelly Smart Control**

**Instalação idêntica ao Shelly Plus 1PM:**
- Instale o app → energize o Shelly → conecte ao WiFi pelo app
- Anote o IP e fixe no roteador
- Instalação elétrica: L → Shelly → O → Máquina

**Diferenciais do Gen3:**
- Suporta WiFi, Bluetooth e **Matter** (protocolo universal de casa inteligente)
- Mais compacto e eficiente
- O sistema SISGO usa a API RPC automaticamente

**Teste:** Acesse `http://<IP>/rpc/Shelly.GetStatus` no navegador para verificar se está online.'
WHERE id = 'shelly_1pm_gen3';

UPDATE laundry_device_models SET setup_instructions =
'**O que você vai precisar:**
- 1x Shelly 1PM Gen4
- Acesso ao roteador WiFi
- Chave de fenda pequena
- Celular com o app **Shelly Smart Control**

**Instalação idêntica ao Shelly Plus 1PM:**
- Instale o app → energize o Shelly → conecte ao WiFi pelo app
- Anote o IP e fixe no roteador
- Instalação elétrica: L → Shelly → O → Máquina

**Diferenciais do Gen4:**
- Suporta WiFi, Bluetooth, **Zigbee** e **Matter**
- O mais recente e completo da linha Shelly
- O sistema SISGO usa a API RPC automaticamente

**Teste:** Acesse `http://<IP>/rpc/Shelly.GetStatus` no navegador.'
WHERE id = 'shelly_1pm_gen4';

UPDATE laundry_device_models SET setup_instructions =
'**O que você vai precisar:**
- 1x Shelly Plus Plug S
- Celular com o app **Shelly Smart Control**
- Acesso ao roteador WiFi

**Instalação super simples — sem eletricista!**

**Passo 1 — Plugar e configurar WiFi**
- Plugue o Shelly Plus Plug S na tomada 220V
- Ele cria uma rede WiFi → conecte o celular nela
- Pelo app, configure o WiFi da base
- Anote o IP e fixe no roteador

**Passo 2 — Conectar a máquina**
- Plugue o cabo de força da máquina no Plug S
- Cadastre no SISGO com o IP → teste a conexão

**Diferenças vs Plug S original:**
- Geração 2 com processador mais rápido e Bluetooth
- Usa API RPC (o sistema detecta automaticamente)

**Atenção:** Suporta até **12A / 2500W**. Verifique a potência da máquina.'
WHERE id = 'shelly_plus_plug_s';

UPDATE laundry_device_models SET setup_instructions =
'**O que você vai precisar:**
- 1x Shelly Pro 1PM
- Trilho DIN no quadro elétrico
- Eletricista qualificado (instalação em quadro)
- Acesso ao roteador WiFi
- Celular com o app **Shelly Smart Control**

**Este modelo é para instalação em quadro elétrico (DIN rail).**

**Passo 1 — Instalação física**
- **DESLIGUE o disjuntor geral**
- Encaixe o Shelly Pro no trilho DIN do quadro
- Conecte a fiação: L (fase) → O (saída para o circuito da máquina) → N (neutro)
- Ligue o disjuntor

**Passo 2 — Configurar WiFi**
- O Shelly Pro também tem porta **Ethernet** (opcional)
- Configure WiFi pelo app Shelly ou pela interface web
- Anote o IP e fixe no roteador

**Passo 3 — SISGO**
- Cadastre a máquina com o IP → Testar conexão

**Vantagens do Pro:**
- Suporta até **16A** com medição precisa
- Instalação mais limpa (dentro do quadro)
- Tem porta Ethernet para conexão cabeada (mais estável)'
WHERE id = 'shelly_pro_1pm';

-- ── Sonoff com Tasmota ──────────────────────────────────────────────────────

UPDATE laundry_device_models SET setup_instructions =
'**ATENÇÃO: Este dispositivo precisa de firmware Tasmota.**
O Sonoff Basic de fábrica usa a nuvem eWeLink e **não funciona** com controle local. É necessário instalar o firmware Tasmota para habilitar a API HTTP local.

**O que você vai precisar:**
- 1x Sonoff Basic R2 ou R3
- Adaptador USB-Serial (FTDI ou CH340) — ~R$ 15
- Fios jumper fêmea-fêmea (4 unidades)
- Computador com o software **Tasmotizer** instalado
- Chave de fenda para abrir o Sonoff
- Acesso ao roteador WiFi

**Passo 1 — Abrir o Sonoff e conectar o serial**
- Remova os 2 parafusos da tampa do Sonoff
- Localize os 4 pinos na placa: **3V3, RX, TX, GND**
- Conecte ao adaptador USB-Serial:
  - Sonoff 3V3 → Adaptador 3V3
  - Sonoff RX → Adaptador TX
  - Sonoff TX → Adaptador RX
  - Sonoff GND → Adaptador GND
- **NÃO conecte na tomada 220V enquanto o serial estiver conectado!**

**Passo 2 — Instalar o Tasmota**
- Baixe e instale o **Tasmotizer** no computador (https://github.com/tasmota/tasmotizer)
- Conecte o adaptador USB no computador
- Segure o botão do Sonoff enquanto conecta (modo flash)
- No Tasmotizer, selecione a porta COM e clique em **"Tasmotize!"**
- Aguarde ~2 minutos até concluir

**Passo 3 — Configurar WiFi**
- Desconecte o serial e feche o Sonoff
- Energize o Sonoff (pode ser na tomada)
- Ele cria uma rede WiFi **"tasmota-XXXX"**
- Conecte o celular nessa rede
- Abra `http://192.168.4.1` no navegador
- Selecione o WiFi da base, digite a senha, salve
- O Sonoff vai reiniciar e conectar na sua rede

**Passo 4 — Configurar o timer automático**
- Descubra o IP do Sonoff (verifique no roteador ou use um scanner de rede)
- Acesse `http://<IP>` no navegador → interface web do Tasmota
- Vá em **Console** e digite estes 2 comandos (um por vez):
  - `Rule1 ON Rules#Timer=1 DO Power Off ENDON`
  - `Rule1 1`
- Esses comandos fazem o Sonoff desligar automaticamente quando o timer acabar

**Passo 5 — Fixar IP e cadastrar no SISGO**
- Fixe o IP no roteador (DHCP Reservation)
- No SISGO → Lavanderia → Máquinas → cadastre com o IP
- Teste a conexão

**Instalação elétrica:**
- **DESLIGUE o disjuntor**
- O Sonoff tem bornes de entrada (L, N) e saída (L out, N out)
- Entrada: fase e neutro da tomada
- Saída: fase e neutro para a máquina
- Ligue o disjuntor

**Se não funcionar:**
- Verifique se o firmware Tasmota foi instalado corretamente
- Acesse `http://<IP>/cm?cmnd=Status%200` no navegador
- Se a rede WiFi mudou, o Sonoff volta a criar a rede "tasmota-XXXX"'
WHERE id = 'sonoff_basic_tasmota';

UPDATE laundry_device_models SET setup_instructions =
'**ATENÇÃO: Este dispositivo precisa de firmware Tasmota.**

**O que você vai precisar:**
- 1x Sonoff Mini R2, R3 ou R4
- Acesso ao roteador WiFi
- Para o R4: pode usar o **DIY Mode** (sem soldar)
- Para R2/R3: adaptador USB-Serial + Tasmotizer

**Opção A — DIY Mode (Sonoff Mini R4 apenas):**
- Ligue o Sonoff e segure o botão por 5 segundos → entra em modo DIY
- Conecte ao WiFi "ITEAD-XXXXXXXX"
- Instale Tasmota via OTA pelo navegador em `http://10.10.0.1`

**Opção B — Flash via serial (todos os modelos):**
- Abra o Sonoff Mini (cuidado, é pequeno)
- Conecte os pinos 3V3, RX, TX, GND ao adaptador USB-Serial
- Use o Tasmotizer para instalar o firmware
- Siga os mesmos passos do Sonoff Basic para configurar WiFi e timer

**Configuração do timer (obrigatório):**
- Acesse `http://<IP>` → Console → digite:
  - `Rule1 ON Rules#Timer=1 DO Power Off ENDON`
  - `Rule1 1`

**Instalação elétrica:**
- O Sonoff Mini é **muito compacto** — cabe dentro da caixa da tomada
- Conecte L (entrada), L (saída), N (neutro), e opcionalmente S1/S2 para interruptor físico
- Fixe o IP no roteador e cadastre no SISGO'
WHERE id = 'sonoff_mini_tasmota';

UPDATE laundry_device_models SET setup_instructions =
'**ATENÇÃO: Este dispositivo precisa de firmware Tasmota.**

**O que você vai precisar:**
- 1x Sonoff POW R2 ou R3
- Adaptador USB-Serial + Tasmotizer
- Acesso ao roteador WiFi

**O Sonoff POW é o modelo com medição de energia (voltagem, corrente, potência).**

**Instalação do Tasmota:**
- Siga os mesmos passos do Sonoff Basic para instalar o firmware
- O POW R3 usa o chip BL0942 — certifique-se de selecionar o template correto no Tasmota

**Configuração do timer:**
- Acesse `http://<IP>` → Console → digite:
  - `Rule1 ON Rules#Timer=1 DO Power Off ENDON`
  - `Rule1 1`

**Instalação elétrica:**
- **DESLIGUE o disjuntor**
- Bornes: L (fase entrada), N (neutro), L out (fase saída para máquina)
- O POW suporta até **16A** — verifique a potência da máquina
- Fixe o IP no roteador e cadastre no SISGO'
WHERE id = 'sonoff_pow_tasmota';

UPDATE laundry_device_models SET setup_instructions =
'**ATENÇÃO: Este dispositivo precisa de firmware Tasmota.**

**O que você vai precisar:**
- 1x Sonoff S31 Plug
- Adaptador USB-Serial + Tasmotizer
- Acesso ao roteador WiFi

**O S31 é uma tomada inteligente (plug) — mais fácil de instalar que os módulos.**

**Instalação do Tasmota:**
- Abra o S31 (4 parafusos na base)
- Localize os pinos de flash na placa
- Conecte o USB-Serial e use o Tasmotizer
- Feche o S31 e plugue na tomada

**Configuração WiFi e timer:**
- Conecte na rede "tasmota-XXXX"
- Configure o WiFi da base em `http://192.168.4.1`
- Console → `Rule1 ON Rules#Timer=1 DO Power Off ENDON` → `Rule1 1`

**Uso:**
- Plugue a máquina de lavar no S31
- Fixe o IP no roteador → cadastre no SISGO
- O S31 tem medição de energia (mostra consumo)'
WHERE id = 'sonoff_s31_tasmota';

-- ── Tuya / Smart Life ───────────────────────────────────────────────────────

UPDATE laundry_device_models SET setup_instructions =
'**ATENÇÃO: Dispositivos Tuya de fábrica usam nuvem e NÃO funcionam com controle local.**
É necessário instalar o firmware **Tasmota** para habilitar a API HTTP local.

**O que você vai precisar:**
- 1x Smart Plug Tuya/Smart Life
- Computador com Linux (ou Raspberry Pi) para o **tuya-convert**
- Acesso ao roteador WiFi

**Método 1 — tuya-convert (OTA, sem abrir o dispositivo) — RECOMENDADO:**

**Passo 1 — Preparar o tuya-convert**
- Em um computador Linux ou Raspberry Pi, clone o repositório:
  - `git clone https://github.com/ct-Open-Source/tuya-convert`
  - `cd tuya-convert && ./install_prereq.sh`
- Execute: `./start_flash.sh`
- O script cria uma rede WiFi falsa que intercepta a atualização

**Passo 2 — Colocar o plug em modo de pareamento**
- Plugue o Smart Plug na tomada
- Segure o botão por **5-10 segundos** até a luz piscar rapidamente
- Isso coloca ele em modo de pareamento (pronto para receber firmware)

**Passo 3 — Flashear**
- No computador, conecte na rede "vtrust-flash"
- O tuya-convert vai detectar o dispositivo
- Escolha **"tasmota.bin"** quando perguntado
- Aguarde ~2 minutos

**Passo 4 — Configurar WiFi e timer**
- O plug agora é um dispositivo Tasmota
- Conecte na rede "tasmota-XXXX"
- Configure o WiFi da base em `http://192.168.4.1`
- Console → `Rule1 ON Rules#Timer=1 DO Power Off ENDON` → `Rule1 1`
- Fixe o IP no roteador

**Passo 5 — Cadastrar no SISGO**
- Lavanderia → Máquinas → cadastre com o IP
- Teste a conexão

**Método 2 — Flash via serial (se tuya-convert não funcionar):**
- Alguns modelos mais novos bloqueiam o tuya-convert
- Nesse caso, abra o plug, solde fios nos pinos de flash (3V3, RX, TX, GND)
- Use o Tasmotizer no computador para instalar o firmware
- Depois siga os mesmos passos de WiFi e timer

**Se não funcionar:**
- Verifique se o firmware Tasmota foi instalado (acesse `http://<IP>`)
- Alguns plugs Tuya mais novos não são compatíveis com tuya-convert
- Considere usar um **Shelly Plug S** como alternativa mais simples'
WHERE id = 'tuya_plug_tasmota';

UPDATE laundry_device_models SET setup_instructions =
'**ATENÇÃO: Dispositivos Tuya de fábrica usam nuvem e NÃO funcionam com controle local.**
É necessário instalar o firmware **Tasmota**.

**O que você vai precisar:**
- 1x Smart Switch Tuya/Smart Life (interruptor de parede)
- Computador Linux ou Raspberry Pi para **tuya-convert**
- Acesso ao roteador WiFi

**Instalação do Tasmota:**
- Siga os mesmos passos do **Tuya Smart Plug (Tasmota)** acima
- Coloque o switch em modo pareamento (segure botão 5-10s)
- Use tuya-convert ou flash via serial

**Configuração WiFi e timer:**
- Conecte na rede "tasmota-XXXX" → configure WiFi da base
- Console → `Rule1 ON Rules#Timer=1 DO Power Off ENDON` → `Rule1 1`

**Instalação elétrica:**
- **DESLIGUE o disjuntor**
- Substitua o interruptor existente pelo Smart Switch
- Conecte L (fase), N (neutro) e a saída para a máquina
- Fixe o IP no roteador → cadastre no SISGO'
WHERE id = 'tuya_switch_tasmota';

UPDATE laundry_device_models SET setup_instructions =
'**ATENÇÃO: Dispositivos Tuya de fábrica usam nuvem e NÃO funcionam com controle local.**
É necessário instalar o firmware **Tasmota**.

**O que você vai precisar:**
- 1x Módulo relé Tuya/Smart Life
- Adaptador USB-Serial + fios jumper (flash obrigatório via serial)
- Ferro de solda (pode precisar soldar pinos)
- Acesso ao roteador WiFi

**Instalação do Tasmota (via serial):**
- Abra o módulo relé e localize os pinos de flash (3V3, RX, TX, GND)
- Se não houver pinos, será necessário soldar
- Conecte ao adaptador USB-Serial
- Use o Tasmotizer para flashear o firmware Tasmota
- Feche o módulo

**Configuração WiFi e timer:**
- Conecte na rede "tasmota-XXXX" → configure WiFi da base
- Console → `Rule1 ON Rules#Timer=1 DO Power Off ENDON` → `Rule1 1`

**Instalação elétrica:**
- **DESLIGUE o disjuntor**
- L (fase entrada) → Relé → Saída → Máquina
- N (neutro compartilhado)
- Fixe o IP no roteador → cadastre no SISGO'
WHERE id = 'tuya_relay_tasmota';

-- ── Positivo ────────────────────────────────────────────────────────────────

UPDATE laundry_device_models SET setup_instructions =
'**ATENÇÃO: A Positivo Casa Inteligente usa chip Tuya internamente.**
O app original da Positivo usa nuvem e NÃO funciona com controle local. É necessário instalar o firmware **Tasmota**.

**O que você vai precisar:**
- 1x Positivo Smart Plug Wi-Fi
- Computador Linux ou Raspberry Pi para **tuya-convert**
- Acesso ao roteador WiFi

**Instalação — siga os passos do Tuya Smart Plug:**
- O processo é idêntico pois o chip interno é Tuya
- Use tuya-convert para flashear Tasmota sem abrir o dispositivo
- Coloque em modo pareamento (segure botão 5-10s)
- Configure WiFi e regra de timer

**Configuração do timer (obrigatório):**
- Acesse `http://<IP>` → Console → digite:
  - `Rule1 ON Rules#Timer=1 DO Power Off ENDON`
  - `Rule1 1`

**Após configurar:**
- Plugue a máquina de lavar no Smart Plug
- Fixe o IP no roteador → cadastre no SISGO → teste a conexão

**Alternativa mais simples:** Se achar o processo de flash complicado, considere comprar um **Shelly Plug S** que já funciona com API local de fábrica, sem precisar instalar firmware.'
WHERE id = 'positivo_plug_tasmota';

-- ── Intelbras IZY ───────────────────────────────────────────────────────────

UPDATE laundry_device_models SET setup_instructions =
'**ATENÇÃO: A Intelbras IZY usa chip Tuya internamente.**
O app original da Intelbras usa nuvem e NÃO funciona com controle local. É necessário instalar o firmware **Tasmota**.

**O que você vai precisar:**
- 1x Intelbras IZY Smart Plug
- Computador Linux ou Raspberry Pi para **tuya-convert**
- Acesso ao roteador WiFi

**Instalação — siga os passos do Tuya Smart Plug:**
- Processo idêntico ao Tuya pois o chip interno é o mesmo
- Use tuya-convert ou flash via serial
- Configure WiFi e regra de timer

**Configuração do timer:**
- `http://<IP>` → Console → `Rule1 ON Rules#Timer=1 DO Power Off ENDON` → `Rule1 1`

**Após configurar:**
- Plugue a máquina no Smart Plug → fixe IP → cadastre no SISGO

**Alternativa mais simples:** Considere um **Shelly Plug S** que funciona com API local de fábrica.'
WHERE id = 'intelbras_plug_tasmota';

-- ── Ekaza ────────────────────────────────────────────────────────────────────

UPDATE laundry_device_models SET setup_instructions =
'**ATENÇÃO: Ekaza usa chip Tuya internamente.**
É necessário instalar o firmware **Tasmota** para controle local.

**Instalação:**
- Siga os mesmos passos do **Tuya Smart Plug (Tasmota)**
- Use tuya-convert ou flash via serial
- Configure WiFi e regra de timer

**Configuração do timer:**
- `http://<IP>` → Console → `Rule1 ON Rules#Timer=1 DO Power Off ENDON` → `Rule1 1`

**Alternativa mais simples:** Considere um **Shelly Plug S** que funciona com API local de fábrica.'
WHERE id = 'ekaza_plug_tasmota';

-- ── Genéricos ───────────────────────────────────────────────────────────────

UPDATE laundry_device_models SET setup_instructions =
'**Qualquer dispositivo com firmware Tasmota instalado.**

**Pré-requisito:** O firmware Tasmota já deve estar instalado no dispositivo. Se ainda não está, consulte a documentação da marca específica para saber como flashear.

**Passo 1 — Conectar ao WiFi**
- Se o dispositivo ainda não está na rede, ele cria uma rede WiFi "tasmota-XXXX"
- Conecte o celular nessa rede
- Acesse `http://192.168.4.1` no navegador
- Configure o WiFi da base e salve

**Passo 2 — Configurar o timer automático (OBRIGATÓRIO)**
- Descubra o IP do dispositivo (verifique no roteador)
- Acesse `http://<IP>` no navegador
- Vá em **Console** e digite estes comandos:
  - `Rule1 ON Rules#Timer=1 DO Power Off ENDON`
  - `Rule1 1`
- Esses comandos fazem o dispositivo desligar automaticamente quando o tempo acabar
- Sem essa configuração, a máquina **não vai desligar sozinha**

**Passo 3 — Fixar IP e cadastrar**
- Fixe o IP no roteador (DHCP Reservation)
- No SISGO → Lavanderia → Máquinas → cadastre com o IP
- Teste a conexão

**Verificar se está funcionando:**
- Acesse `http://<IP>/cm?cmnd=Status%200` no navegador
- Deve retornar um JSON com informações do dispositivo'
WHERE id = 'tasmota_generic';

UPDATE laundry_device_models SET setup_instructions =
'**Para dispositivos com API HTTP customizada.**

**Como funciona:**
Os templates de URL usam duas variáveis que o sistema substitui automaticamente:
- `{ip}` → será substituído pelo IP do dispositivo (ex: 192.168.1.100)
- `{seconds}` → será substituído pelo tempo em segundos (ex: 2700 para 45 min)

**Exemplo de templates:**
- Ligar: `http://{ip}/relay/0?turn=on&timer={seconds}`
- Desligar: `http://{ip}/relay/0?turn=off`
- Status: `http://{ip}/status`

**Como configurar um dispositivo customizado:**
1. Consulte a documentação/API do seu dispositivo
2. Identifique as URLs para ligar (com timer), desligar e verificar status
3. Substitua o IP real por `{ip}` e o tempo por `{seconds}` nos templates
4. Cadastre o modelo em **Lavanderia → Dispositivos → Cadastrar dispositivo customizado**
5. Depois cadastre a máquina selecionando o modelo criado

**Requisitos do dispositivo:**
- Precisa ter API HTTP local (acessível pela rede WiFi)
- Precisa suportar timer/auto-off por parâmetro na URL
- Precisa ter um endpoint de status para verificar se está online
- Dispositivos cloud-only (que só funcionam pelo app) **não são compatíveis**'
WHERE id = 'custom_http_relay';
