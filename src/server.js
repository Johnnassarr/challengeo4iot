require('dotenv').config();

const mqtt = require('mqtt');
const { Pool } = require('pg');

const {
  MQTT_BROKER_URL = 'mqtt://mqtt.wokwi.com:1883',
  MQTT_USERNAME,
  MQTT_PASSWORD,
  MQTT_TOPIC = 'mottu/destino',
  PGHOST = 'localhost',
  PGPORT = 5432,
  PGDATABASE = 'iot',
  PGUSER = 'postgres',
  PGPASSWORD
} = process.env;

if (!PGPASSWORD) {
  console.error('Missing required environment variable: PGPASSWORD');
  process.exit(1);
}

const pool = new Pool({
  host: PGHOST,
  port: Number(PGPORT),
  database: PGDATABASE,
  user: PGUSER,
  password: PGPASSWORD,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
});

function handleMessage(payloadBuffer) {
  try {
    const payload = JSON.parse(payloadBuffer.toString('utf8'));
    const {
      deviceId,
      usuarioId,
      eventType,
      setor,
      timestamp,
      date,
      message,
      distanceCm
    } = payload;

    if (!deviceId || !usuarioId || !eventType || !setor) {
      console.warn('Payload missing required fields:', payload);
      return;
    }

    const preparedTimestamp = prepareTimestamp(date ?? timestamp);

    const insertQuery = `
      INSERT INTO public."MOTTU_EVENTS" (
        "DEVICE_ID",
        "USUARIO_ID",
        "EVENT_TYPE",
        "SETOR",
        "DISTANCE_CM",
        "Date"
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id;
    `;

    const values = [
      deviceId,
      usuarioId,
      eventType,
      setor,
      typeof distanceCm === 'number'
        ? distanceCm
        : typeof payload.distance === 'number'
          ? payload.distance
          : null,
      preparedTimestamp
    ];

    pool.query(insertQuery, values).then(({ rows }) => {
      console.log(`Event stored with id=${rows[0].id}`);
    }).catch((err) => {
      console.error('Failed to insert event:', err);
    });
  } catch (err) {
    console.error('Failed to parse payload:', err);
  }
}

function prepareTimestamp(timestamp) {
  if (timestamp === undefined || timestamp === null) {
    return null;
  }

  if (timestamp instanceof Date) {
    return timestamp;
  }

  if (typeof timestamp === 'string') {
    const parsed = Date.parse(timestamp);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
    console.warn('Timestamp string in unexpected format:', timestamp);
    return null;
  }

  if (typeof timestamp === 'number') {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      console.warn('Timestamp number invalid:', timestamp);
      return null;
    }
    const millis = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
    return new Date(millis);
  }

  console.warn('Unexpected timestamp type:', typeof timestamp);
  return null;
}

async function start() {
  const mqttOptions = {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD
  };

  const client = mqtt.connect(MQTT_BROKER_URL, mqttOptions);

  client.on('connect', () => {
    console.log(`Connected to MQTT broker ${MQTT_BROKER_URL}`);
    client.subscribe(MQTT_TOPIC, (err) => {
      if (err) {
        console.error(`Failed to subscribe to topic ${MQTT_TOPIC}:`, err);
        process.exit(1);
      }
      console.log(`Subscribed to topic ${MQTT_TOPIC}`);
    });
  });

  client.on('message', (_, payload) => {
    console.log('MQTT payload received:', payload.toString());
    handleMessage(payload);
  });

  client.on('error', (err) => {
    console.error('MQTT error:', err);
  });

  process.on('SIGINT', async () => {
    console.log('Gracefully shutting down...');
    client.end(true);
    await pool.end();
    process.exit(0);
  });
}

start().catch((err) => {
  console.error('Unexpected error on startup:', err);
  process.exit(1);
});

