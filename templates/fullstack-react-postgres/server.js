import express from 'express';
import pg from 'pg';
import cors from 'cors';
import bodyParser from 'body-parser';

const { Pool } = pg;

const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// PostgreSQL connection
// Auto-create team-specific database
const dbName = 'preview_TEAM_ID_PLACEHOLDER'.replace(/-/g, '_');

const pool = new Pool({
  host: '172.17.0.1', // Docker bridge gateway IP
  port: 5433,
  database: dbName,
  user: 'postgres',
  password: 'password'
});

// Initialize database - create database if needed and table
async function initDB() {
  // First, create database if it doesn't exist
  const tempPool = new Pool({
    host: '172.17.0.1',
    port: 5433,
    user: 'postgres',
    password: 'password'
  });

  try {
    await tempPool.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Created database ${dbName}`);
  } catch (err) {
    if (err.code !== '42P04') { // Database already exists
      console.error('Error creating database:', err);
    }
  } finally {
    await tempPool.end();
  }

  // Now create table in the team database
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS entries (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

initDB();

// API Routes

// Get all entries
app.get('/api/entries', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM entries ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single entry
app.get('/api/entries/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM entries WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new entry
app.post('/api/entries', async (req, res) => {
  const { name, email, message } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO entries (name, email, message) VALUES ($1, $2, $3) RETURNING *',
      [name, email || null, message || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update entry
app.put('/api/entries/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, message } = req.body;

  try {
    const result = await pool.query(
      'UPDATE entries SET name = $1, email = $2, message = $3 WHERE id = $4 RETURNING *',
      [name, email, message, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete entry
app.delete('/api/entries/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM entries WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    res.json({ message: 'Entry deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await pool.end();
  console.log('Database connection closed.');
  process.exit(0);
});
