# IoT Wokwi Listener

link iot = https://wokwi.com/projects/431972219227799553

Servidor Node.js que assina um tópico MQTT publicado pelo Wokwi e persiste os eventos no PostgreSQL.

## Pré-requisitos

- Node.js 18+
- PostgreSQL 13+
- Acesso a um broker MQTT (por exemplo, `mqtt://mqtt.wokwi.com:1883`)

## Configuração

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie um arquivo `.env` na raiz do projeto com os parâmetros abaixo:

   ```bash
   MQTT_BROKER_URL=mqtt://mqtt.wokwi.com:1883
   MQTT_TOPIC=mottu/destino
   # MQTT_USERNAME=seu_usuario
   # MQTT_PASSWORD=sua_senha

   PGHOST=localhost
   PGPORT=5432
   PGDATABASE=iot
   PGUSER=postgres
   PGPASSWORD=sua_senha
   # PGSSL=true
   ```

   Ajuste conforme a sua infraestrutura.

## Execução

```bash
npm start
```

Ao iniciar, o servidor irá:

- Conectar-se ao broker MQTT configurado.
- Assinar o tópico informado (padrão: `mottu/destino`).
- Inserir cada payload recebido na tabela `public."MOTTU_EVENTS"` do PostgreSQL (Supabase).

Você verá logs no terminal informando os eventos inseridos ou eventuais erros.

## Estrutura do payload esperado

```json
{
  "deviceId": "mottu-unidade-01",
  "usuarioId": "usuario123",
  "eventType": "DESTINO",
  "setor": "Devolucao",
  "timestamp": 476530,
  "message": "texto opcional",
  "distanceCm": 42.5,
  "temperatureC": 28.3,
  "humidity": 55.1
}
```

Campos obrigatórios: `deviceId`, `usuarioId`, `eventType`, `setor`, `timestamp` (numérico).

Ao inserir no banco:
- `DISTANCE_CM` é preenchido apenas se `distanceCm` (ou `distance`) for numérico; do contrário fica `NULL`.
- A coluna `"Date"` recebe:
  - o valor de `date` (se presente) convertido para `timestamp with time zone`, ou
  - o valor de `timestamp` (segundos/milisegundos desde epoch) convertido para `timestamp with time zone`.
  Se nenhum dado válido for enviado, o campo fica `NULL`.

