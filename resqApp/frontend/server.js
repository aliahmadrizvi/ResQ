const express = require('express');
const snowflake = require('snowflake-sdk');
const cors = require('cors'); // 1. Import CORS so your frontend can talk to this server

const app = express();
app.use(express.json());
app.use(cors()); // 2. Enable CORS for all incoming requests

// ==========================================
// CONFIG: Replace these strings with your actual Snowflake credentials 
// or set them as environment variables in your terminal before running.
// ==========================================
const connection = snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT || 'http://xo60115.ap-southeast-7.aws/',
    username: process.env.SNOWFLAKE_USER || 'imadfazli',
    password: process.env.SNOWFLAKE_PASSWORD || 'imadfazli@12345',
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'COMPUTE_WH',
    database: process.env.SNOWFLAKE_DATABASE || 'RESQ_DB',
    schema: process.env.SNOWFLAKE_SCHEMA || 'PUBLIC'
});

// 3. Establish the connection to Snowflake on startup
connection.connect((err, conn) => {
    if (err) {
        console.error('❌ Failed to connect to Snowflake: ' + err.message);
    } else {
        console.log('✅ Connected to Snowflake Data Cloud successfully as ID: ' + conn.getId());
    }
});

// Chat API Endpoint for Snowflake Cortex AI
app.post('/api/chat', (req, res) => {
    const userMessage = req.body.message;
    if (!userMessage) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const sqlStatement = `
        SELECT SNOWFLAKE.CORTEX.COMPLETE(
            'llama3-70b', 
            'You are a helpful emergency response assistant for ResQ. Provide concise, safe instructions for: ' || ?
        ) AS reply
    `;

    connection.execute({
        sqlText: sqlStatement,
        binds: [userMessage],
        complete: (err, stmt, rows) => {
            if (err) {
                console.error('⚠️ Snowflake Execution Error: ' + err.message);
                return res.status(500).json({ error: 'Failed to fetch AI response from Snowflake' });
            }
            
            // Safe extraction supporting both uppercase and lowercase row keys
            const row = rows && rows.length > 0 ? rows[0] : {};
            const aiResponse = row.REPLY || row.reply || Object.values(row)[0] || "No response generated.";
            
            res.json({ reply: aiResponse });
        }
    });
});

app.listen(3000, () => {
    console.log('🚀 ResQ Backend Bridge running on http://localhost:3000');
});