const express = require('express');
const snowflake = require('snowflake-sdk');
const cors = require('cors');
const path = require('path');


if (typeof process.loadEnvFile === 'function') {
    try {
        process.loadEnvFile(path.resolve(__dirname, '../../.env'));
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
    }
}

const app = express();
const port = Number(process.env.PORT || 3002);
const maxMessageLength = 2000;

app.use(cors());
app.use(express.json({ limit: '16kb' }));
app.use(express.static(__dirname));

const normalizeAccount = (value = '') => value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\.snowflakecomputing\.com\/?$/i, '')
    .replace(/\/$/, '');

const config = {
    account: normalizeAccount(process.env.SNOWFLAKE_ACCOUNT),
    username: process.env.SNOWFLAKE_USER?.trim(),
    authenticator: process.env.SNOWFLAKE_AUTHENTICATOR?.trim().toUpperCase() || 'SNOWFLAKE',
    password: process.env.SNOWFLAKE_PASSWORD,
    token: process.env.SNOWFLAKE_TOKEN?.trim(),
    warehouse: process.env.SNOWFLAKE_WAREHOUSE?.trim(),
    database: process.env.SNOWFLAKE_DATABASE?.trim(),
    schema: process.env.SNOWFLAKE_SCHEMA?.trim() || 'PUBLIC',
    role: process.env.SNOWFLAKE_ROLE?.trim(),
    model: process.env.SNOWFLAKE_CORTEX_MODEL?.trim() || 'llama3.1-70b'
};

const usesPat = config.authenticator === 'PROGRAMMATIC_ACCESS_TOKEN';
const missingConfig = [
    ...['account', 'username', 'warehouse', 'database'].filter((key) => !config[key]),
    ...(usesPat ? (config.token ? [] : ['token']) : (config.password ? [] : ['password']))
];
let connection;
let connectionState = missingConfig.length ? 'not_configured' : 'connecting';
let connectionError = null;
let connectionRetryTimer = null;

app.get('/api/health', (_req, res) => {
    res.status(connectionState === 'connected' ? 200 : 503).json({
        status: connectionState,
        ...(connectionError ? { error: connectionError } : {})
    });
});

function scheduleConnectionRetry() {
    if (connectionRetryTimer || missingConfig.length) return;
    connectionRetryTimer = setTimeout(() => {
        connectionRetryTimer = null;
        connectToSnowflake();
    }, 15000);
}

function connectToSnowflake() {
    connectionState = 'connecting';
    const nextConnection = snowflake.createConnection({
        account: config.account,
        username: config.username,
        authenticator: config.authenticator,
        ...(usesPat ? { token: config.token } : { password: config.password }),
        warehouse: config.warehouse,
        database: config.database,
        schema: config.schema,
        ...(config.role ? { role: config.role } : {})
    });

    nextConnection.connect((err, conn) => {
        if (err) {
            connection = null;
            connectionState = 'disconnected';
            connectionError = err.message;
            console.error(`Snowflake connection failed${err.code ? ` (${err.code})` : ''}: ${err.message}`);
            scheduleConnectionRetry();
            return;
        }

        connection = conn;
        connectionState = 'connected';
        connectionError = null;
        console.log(`Connected to Snowflake (connection ${conn.getId()}).`);
    });
}

if (missingConfig.length) {
    console.error(`Snowflake is not configured. Set: ${missingConfig.map((key) => ({
        account: 'SNOWFLAKE_ACCOUNT', username: 'SNOWFLAKE_USER', password: 'SNOWFLAKE_PASSWORD', token: 'SNOWFLAKE_TOKEN',
        warehouse: 'SNOWFLAKE_WAREHOUSE', database: 'SNOWFLAKE_DATABASE'
    })[key]).join(', ')}`);
} else {
    connectToSnowflake();
}

// Cortex AI Translation API Endpoint
app.post('/api/translate', (req, res) => {
    const textToTranslate = req.body.text;

    if (!textToTranslate) {
        return res.status(400).json({ error: 'Text is required' });
    }

    // Leaving the source language as '' forces Snowflake to auto-detect the language
    const sqlStatement = `SELECT SNOWFLAKE.CORTEX.TRANSLATE(?, '', 'en') AS translated_text`;

    connection.execute({
        sqlText: sqlStatement,
        binds: [textToTranslate],
        complete: (err, stmt, rows) => {
            if (err) {
                console.error('⚠️ Snowflake Translation Error: ' + err.message);
                return res.status(500).json({ error: 'Translation failed' });
            }
            
            // Extract response supporting varying Snowflake column casings
            const row = rows && rows.length > 0 ? rows[0] : {};
            const result = row.TRANSLATED_TEXT || row.translated_text || Object.values(row)[0];
            
            res.json({ translation: result });
        }
    });
});

app.post('/api/chat', (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) return res.status(400).json({ error: 'Message is required.' });
    if (message.length > maxMessageLength) {
        return res.status(413).json({ error: `Message must be ${maxMessageLength} characters or fewer.` });
    }
    if (connectionState !== 'connected' || !connection) {
        const detail = connectionError ? `: ${connectionError}` : '.';
        return res.status(503).json({ error: `Snowflake is ${connectionState}${detail}` });
    }

    const prompt = `You are a helpful emergency response assistant for ResQ. Give concise, safe instructions for this situation: ${message}`;
    connection.execute({
        sqlText: 'SELECT SNOWFLAKE.CORTEX.COMPLETE(?, ?) AS REPLY',
        binds: [config.model, prompt],
        complete: (err, _statement, rows) => {
            if (err) {
                console.error(`Snowflake Cortex query failed${err.code ? ` (${err.code})` : ''}: ${err.message}`);
                return res.status(502).json({ error: `Cortex query failed${err.code ? ` (${err.code})` : ''}: ${err.message}` });
            }

            const reply = rows?.[0]?.REPLY ?? rows?.[0]?.reply;
            if (typeof reply !== 'string' || !reply.trim()) {
                return res.status(502).json({ error: 'Snowflake returned an empty response.' });
            }
            res.json({ reply });
        }
    });
});

app.listen(port, () => {
    console.log(`ResQ Snowflake backend listening on http://localhost:${port}.`);
});
