const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { encrypt, decrypt } = require('./encryption.js');

const app = express();
const port = 8080;

app.use(cors());
app.use(express.json());
// Removed static file serving for security

// Initialize SQLite Database
const db = new sqlite3.Database('./data.db', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Setup table
        db.run(`CREATE TABLE IF NOT EXISTS store (
            id TEXT PRIMARY KEY,
            storeName TEXT NOT NULL,
            data TEXT NOT NULL
        )`);
    }
});

// Generic endpoint to get all items from a "store"
app.get('/api/data/:store', (req, res) => {
    const storeName = req.params.store;
    db.all(`SELECT id, data FROM store WHERE storeName = ?`, [storeName], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const items = rows.map(row => {
            const decrypted = decrypt(row.data);
            try {
                return JSON.parse(decrypted);
            } catch(e) {
                return null;
            }
        }).filter(Boolean);

        res.json(items);
    });
});

// Generic endpoint to get a single item
app.get('/api/data/:store/:id', (req, res) => {
    const { store: storeName, id } = req.params;
    db.get(`SELECT data FROM store WHERE storeName = ? AND id = ?`, [storeName, id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: "Not found" });
        }
        const decrypted = decrypt(row.data);
        try {
            res.json(JSON.parse(decrypted));
        } catch(e) {
            res.status(500).json({ error: "Corrupted data" });
        }
    });
});

// Generic endpoint to put (insert or update) an item
app.put('/api/data/:store', (req, res) => {
    const storeName = req.params.store;
    const item = req.body;

    if (!item || !item.id) {
        return res.status(400).json({ error: "Item must have an id" });
    }

    const id = item.id;
    const encryptedData = encrypt(JSON.stringify(item));

    db.run(
        `INSERT INTO store (id, storeName, data) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, storeName = excluded.storeName`,
        [id, storeName, encryptedData],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, id: id });
        }
    );
});

// Generic endpoint to delete an item
app.delete('/api/data/:store/:id', (req, res) => {
    const { store: storeName, id } = req.params;
    db.run(`DELETE FROM store WHERE storeName = ? AND id = ?`, [storeName, id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// Endpoint to clear a store
app.delete('/api/data/:store', (req, res) => {
    const storeName = req.params.store;
    db.run(`DELETE FROM store WHERE storeName = ?`, [storeName], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// Start the server
app.listen(port, "127.0.0.1", () => {
    console.log(`Local backend server running at http://localhost:${port}`);
});
