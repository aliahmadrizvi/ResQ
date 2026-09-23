const express = require('express');
const snowflake = require('snowflake-sdk');
const cors = require('cors');

const app = express();
const port = Number(process.env.PORT || 3000);
const maxMessageLength = 2000;

app.use(cors());
app.use(express.json({ limit: '16kb' }));

const normalizeAccount = (value = '') => value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\.snowflakecomputing\.com\/?$/i, '')
    .replace(/\/$/, '');

const config = {
    account: normalizeAccount(process.env.SNOWFLAKE_ACCOUNT),
    username: process.env.SNOWFLAKE_USER?.trim(),
    password: process.env.SNOWFLAKE_PASSWORD,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE?.trim(),
    database: process.env.SNOWFLAKE_DATABASE?.trim(),
    schema: process.env.SNOWFLAKE_SCHEMA?.trim() || 'PUBLIC',
    role: process.env.SNOWFLAKE_ROLE?.trim(),
    model: process.env.SNOWFLAKE_CORTEX_MODEL?.trim() || 'llama3.1-70b'
};

const missingConfig = ['account', 'username', 'password', 'warehouse', 'database']
    .filter((key) => !config[key]);
let connection;
let connectionState = missingConfig.length ? 'not_configured' : 'connecting';

app.get('/api/health', (_req, res) => {
    res.status(connectionState === 'connected' ? 200 : 503).json({ status: connectionState });
});

if (missingConfig.length) {
    console.error(`Snowflake is not configured. Set: ${missingConfig.map((key) => ({
        account: 'SNOWFLAKE_ACCOUNT', username: 'SNOWFLAKE_USER', password: 'SNOWFLAKE_PASSWORD',
        warehouse: 'SNOWFLAKE_WAREHOUSE', database: 'SNOWFLAKE_DATABASE'
    })[key]).join(', ')}`);
} else {
    connection = snowflake.createConnection({
        account: config.account,
        username: config.username,
        password: config.password,
        warehouse: config.warehouse,
        database: config.database,
        schema: config.schema,
        ...(config.role ? { role: config.role } : {})
    });

    connection.connect((err, conn) => {
        if (err) {
            connectionState = 'disconnected';
            console.error(`Snowflake connection failed: ${err.message}`);
            return;
        }

        connectionState = 'connected';
        console.log(`Connected to Snowflake (connection ${conn.getId()}).`);
    });
}

app.post('/api/chat', (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
        return res.status(400).json({ error: 'Message is required.' });
    }
    if (message.length > maxMessageLength) {
        return res.status(413).json({ error: `Message must be ${maxMessageLength} characters or fewer.` });
    }
    if (connectionState !== 'connected') {
        return res.status(503).json({ error: 'Snowflake is unavailable. Check the backend configuration and connection.' });
    }

    const prompt = `You are a helpful emergency response assistant for ResQ. Give concise, safe instructions for this situation: ${message}`;
    connection.execute({
        sqlText: 'SELECT SNOWFLAKE.CORTEX.COMPLETE(?, ?) AS REPLY',
        binds: [config.model, prompt],
        complete: (err, _statement, rows) => {
            if (err) {
                console.error(`Snowflake Cortex query failed: ${err.message}`);
                return res.status(502).json({ error: 'Snowflake could not generate a response.' });
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
    console.log(`ResQ backend bridge listening on http://localhost:${port}.`);
});
