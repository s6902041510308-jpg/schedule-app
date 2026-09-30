const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sql } = require('@vercel/postgres');

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Initialize database tables
async function initDB() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        subject TEXT NOT NULL,
        teacher TEXT NOT NULL,
        room TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        days TEXT NOT NULL,
        is_temporary BOOLEAN DEFAULT FALSE,
        temporary_week INTEGER,
        cancelled_weeks TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;

    console.log('Database initialized');
  } catch (err) {
    console.error('Database init error:', err.message);
  }
}

// Password hashing
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// JWT-like token (simplified)
function createToken(userId) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, payload, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
    if (signature !== expectedSig) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

// CORS headers
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendJSON(res, 401, { error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    sendJSON(res, 401, { error: 'Invalid token' });
    return;
  }

  req.userId = decoded.userId;
  next();
}

// Routes
const server = http.createServer(async (req, res) => {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // Register
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    const { username, password } = await parseBody(req);
    if (!username || !password) {
      return sendJSON(res, 400, { error: 'Username and password required' });
    }

    try {
      const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
      if (existing.rows.length > 0) {
        return sendJSON(res, 409, { error: 'Username already exists' });
      }

      const hashed = hashPassword(password);
      const result = await sql`INSERT INTO users (username, password) VALUES (${username}, ${hashed}) RETURNING id`;
      const userId = result.rows[0].id;

      const token = createToken(userId);
      return sendJSON(res, 200, { token, userId });
    } catch (err) {
      console.error('Register error:', err.message);
      return sendJSON(res, 500, { error: 'Server error' });
    }
  }

  // Login
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const { username, password } = await parseBody(req);
    if (!username || !password) {
      return sendJSON(res, 400, { error: 'Username and password required' });
    }

    try {
      const result = await sql`SELECT * FROM users WHERE username = ${username}`;
      const user = result.rows[0];
      if (!user || user.password !== hashPassword(password)) {
        return sendJSON(res, 401, { error: 'Invalid credentials' });
      }

      const token = createToken(user.id);
      return sendJSON(res, 200, { token, userId: user.id });
    } catch (err) {
      console.error('Login error:', err.message);
      return sendJSON(res, 500, { error: 'Server error' });
    }
  }

  // Get all classes
  if (pathname === '/api/classes' && req.method === 'GET') {
    authMiddleware(req, res, async () => {
      try {
        const result = await sql`SELECT * FROM classes WHERE user_id = ${req.userId}`;
        const classes = result.rows.map(c => ({
          ...c,
          is_temporary: !!c.is_temporary,
          cancelled_weeks: JSON.parse(c.cancelled_weeks || '[]')
        }));
        sendJSON(res, 200, classes);
      } catch (err) {
        console.error('Get classes error:', err.message);
        sendJSON(res, 500, { error: 'Server error' });
      }
    });
    return;
  }

  // Create class
  if (pathname === '/api/classes' && req.method === 'POST') {
    authMiddleware(req, res, async () => {
      const { subject, teacher, room, start_time, end_time, days, is_temporary, temporary_week } = await parseBody(req);

      if (!subject || !teacher || !room || !start_time || !end_time || !days) {
        return sendJSON(res, 400, { error: 'All fields are required' });
      }

      try {
        const result = await sql`
          INSERT INTO classes (user_id, subject, teacher, room, start_time, end_time, days, is_temporary, temporary_week)
          VALUES (${req.userId}, ${subject}, ${teacher}, ${room}, ${start_time}, ${end_time}, ${JSON.stringify(days)}, ${is_temporary ? 1 : 0}, ${temporary_week || null})
          RETURNING *
        `;
        const newClass = result.rows[0];
        sendJSON(res, 200, {
          ...newClass,
          is_temporary: !!newClass.is_temporary,
          cancelled_weeks: JSON.parse(newClass.cancelled_weeks || '[]')
        });
      } catch (err) {
        console.error('Create class error:', err.message);
        sendJSON(res, 500, { error: 'Server error' });
      }
    });
    return;
  }

  // Update class
  const updateMatch = pathname.match(/^\/api\/classes\/(\d+)$/);
  if (updateMatch && req.method === 'PUT') {
    authMiddleware(req, res, async () => {
      const classId = parseInt(updateMatch[1]);
      const { subject, teacher, room, start_time, end_time, days } = await parseBody(req);

      try {
        const result = await sql`
          UPDATE classes SET subject = ${subject}, teacher = ${teacher}, room = ${room}, start_time = ${start_time}, end_time = ${end_time}, days = ${JSON.stringify(days)}
          WHERE id = ${classId} AND user_id = ${req.userId}
          RETURNING *
        `;
        if (result.rows.length === 0) {
          return sendJSON(res, 404, { error: 'Class not found' });
        }

        const updated = result.rows[0];
        sendJSON(res, 200, {
          ...updated,
          is_temporary: !!updated.is_temporary,
          cancelled_weeks: JSON.parse(updated.cancelled_weeks || '[]')
        });
      } catch (err) {
        console.error('Update class error:', err.message);
        sendJSON(res, 500, { error: 'Server error' });
      }
    });
    return;
  }

  // Delete class
  const deleteMatch = pathname.match(/^\/api\/classes\/(\d+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    authMiddleware(req, res, async () => {
      const classId = parseInt(deleteMatch[1]);

      try {
        const result = await sql`DELETE FROM classes WHERE id = ${classId} AND user_id = ${req.userId}`;
        if (result.rowCount === 0) {
          return sendJSON(res, 404, { error: 'Class not found' });
        }
        sendJSON(res, 200, { success: true });
      } catch (err) {
        console.error('Delete class error:', err.message);
        sendJSON(res, 500, { error: 'Server error' });
      }
    });
    return;
  }

  // Cancel class for a week
  const cancelMatch = pathname.match(/^\/api\/classes\/(\d+)\/cancel-week$/);
  if (cancelMatch && req.method === 'POST') {
    authMiddleware(req, res, async () => {
      const classId = parseInt(cancelMatch[1]);
      const { week } = await parseBody(req);

      try {
        const existing = await sql`SELECT * FROM classes WHERE id = ${classId} AND user_id = ${req.userId}`;
        if (existing.rows.length === 0) {
          return sendJSON(res, 404, { error: 'Class not found' });
        }

        const cancelledWeeks = JSON.parse(existing.rows[0].cancelled_weeks || '[]');
        if (!cancelledWeeks.includes(week)) {
          cancelledWeeks.push(week);
        }

        const result = await sql`
          UPDATE classes SET cancelled_weeks = ${JSON.stringify(cancelledWeeks)}
          WHERE id = ${classId}
          RETURNING *
        `;
        const updated = result.rows[0];
        sendJSON(res, 200, {
          ...updated,
          is_temporary: !!updated.is_temporary,
          cancelled_weeks: JSON.parse(updated.cancelled_weeks || '[]')
        });
      } catch (err) {
        console.error('Cancel week error:', err.message);
        sendJSON(res, 500, { error: 'Server error' });
      }
    });
    return;
  }

  // Uncancel class for a week
  const uncancelMatch = pathname.match(/^\/api\/classes\/(\d+)\/uncancel-week$/);
  if (uncancelMatch && req.method === 'POST') {
    authMiddleware(req, res, async () => {
      const classId = parseInt(uncancelMatch[1]);
      const { week } = await parseBody(req);

      try {
        const existing = await sql`SELECT * FROM classes WHERE id = ${classId} AND user_id = ${req.userId}`;
        if (existing.rows.length === 0) {
          return sendJSON(res, 404, { error: 'Class not found' });
        }

        const cancelledWeeks = JSON.parse(existing.rows[0].cancelled_weeks || '[]');
        const filtered = cancelledWeeks.filter(w => w !== week);

        const result = await sql`
          UPDATE classes SET cancelled_weeks = ${JSON.stringify(filtered)}
          WHERE id = ${classId}
          RETURNING *
        `;
        const updated = result.rows[0];
        sendJSON(res, 200, {
          ...updated,
          is_temporary: !!updated.is_temporary,
          cancelled_weeks: JSON.parse(updated.cancelled_weeks || '[]')
        });
      } catch (err) {
        console.error('Uncancel week error:', err.message);
        sendJSON(res, 500, { error: 'Server error' });
      }
    });
    return;
  }

  // 404
  sendJSON(res, 404, { error: 'Not found' });
});

// Start server
initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
