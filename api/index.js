const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// In-memory storage (for testing only)
const users = [];
const classes = [];
let nextUserId = 1;
let nextClassId = 1;

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

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

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
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

module.exports = async (req, res) => {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost`);
  const pathname = url.pathname;

  // Register
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    const { username, password } = await parseBody(req);
    if (!username || !password) {
      return sendJSON(res, 400, { error: 'Username and password required' });
    }

    const existing = users.find(u => u.username === username);
    if (existing) {
      return sendJSON(res, 409, { error: 'Username already exists' });
    }

    const user = {
      id: nextUserId++,
      username,
      password: hashPassword(password)
    };
    users.push(user);

    const token = createToken(user.id);
    return sendJSON(res, 200, { token, userId: user.id });
  }

  // Login
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const { username, password } = await parseBody(req);
    if (!username || !password) {
      return sendJSON(res, 400, { error: 'Username and password required' });
    }

    const user = users.find(u => u.username === username);
    if (!user || user.password !== hashPassword(password)) {
      return sendJSON(res, 401, { error: 'Invalid credentials' });
    }

    const token = createToken(user.id);
    return sendJSON(res, 200, { token, userId: user.id });
  }

  // Get all classes
  if (pathname === '/api/classes' && req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendJSON(res, 401, { error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return sendJSON(res, 401, { error: 'Invalid token' });
    }

    const userClasses = classes.filter(c => c.user_id === decoded.userId);
    sendJSON(res, 200, userClasses);
    return;
  }

  // Create class
  if (pathname === '/api/classes' && req.method === 'POST') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendJSON(res, 401, { error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return sendJSON(res, 401, { error: 'Invalid token' });
    }

    const { subject, teacher, room, start_time, end_time, days, is_temporary, temporary_week } = await parseBody(req);

    if (!subject || !teacher || !room || !start_time || !end_time || !days) {
      return sendJSON(res, 400, { error: 'All fields are required' });
    }

    const newClass = {
      id: nextClassId++,
      user_id: decoded.userId,
      subject,
      teacher,
      room,
      start_time,
      end_time,
      days: JSON.stringify(days),
      is_temporary: is_temporary ? 1 : 0,
      temporary_week: temporary_week || null,
      cancelled_weeks: '[]'
    };
    classes.push(newClass);

    sendJSON(res, 200, {
      ...newClass,
      is_temporary: !!newClass.is_temporary,
      cancelled_weeks: JSON.parse(newClass.cancelled_weeks)
    });
    return;
  }

  // Update class
  const updateMatch = pathname.match(/^\/api\/classes\/(\d+)$/);
  if (updateMatch && req.method === 'PUT') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendJSON(res, 401, { error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return sendJSON(res, 401, { error: 'Invalid token' });
    }

    const classId = parseInt(updateMatch[1]);
    const { subject, teacher, room, start_time, end_time, days } = await parseBody(req);

    const classIndex = classes.findIndex(c => c.id === classId && c.user_id === decoded.userId);
    if (classIndex === -1) {
      return sendJSON(res, 404, { error: 'Class not found' });
    }

    classes[classIndex] = {
      ...classes[classIndex],
      subject,
      teacher,
      room,
      start_time,
      end_time,
      days: JSON.stringify(days)
    };

    const updated = classes[classIndex];
    sendJSON(res, 200, {
      ...updated,
      is_temporary: !!updated.is_temporary,
      cancelled_weeks: JSON.parse(updated.cancelled_weeks || '[]')
    });
    return;
  }

  // Delete class
  const deleteMatch = pathname.match(/^\/api\/classes\/(\d+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendJSON(res, 401, { error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return sendJSON(res, 401, { error: 'Invalid token' });
    }

    const classId = parseInt(deleteMatch[1]);
    const classIndex = classes.findIndex(c => c.id === classId && c.user_id === decoded.userId);
    if (classIndex === -1) {
      return sendJSON(res, 404, { error: 'Class not found' });
    }

    classes.splice(classIndex, 1);
    sendJSON(res, 200, { success: true });
    return;
  }

  // Cancel class for a week
  const cancelMatch = pathname.match(/^\/api\/classes\/(\d+)\/cancel-week$/);
  if (cancelMatch && req.method === 'POST') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendJSON(res, 401, { error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return sendJSON(res, 401, { error: 'Invalid token' });
    }

    const classId = parseInt(cancelMatch[1]);
    const { week } = await parseBody(req);

    const classItem = classes.find(c => c.id === classId && c.user_id === decoded.userId);
    if (!classItem) {
      return sendJSON(res, 404, { error: 'Class not found' });
    }

    const cancelledWeeks = JSON.parse(classItem.cancelled_weeks || '[]');
    if (!cancelledWeeks.includes(week)) {
      cancelledWeeks.push(week);
    }

    classItem.cancelled_weeks = JSON.stringify(cancelledWeeks);
    sendJSON(res, 200, {
      ...classItem,
      is_temporary: !!classItem.is_temporary,
      cancelled_weeks: JSON.parse(classItem.cancelled_weeks)
    });
    return;
  }

  // Uncancel class for a week
  const uncancelMatch = pathname.match(/^\/api\/classes\/(\d+)\/uncancel-week$/);
  if (uncancelMatch && req.method === 'POST') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendJSON(res, 401, { error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return sendJSON(res, 401, { error: 'Invalid token' });
    }

    const classId = parseInt(uncancelMatch[1]);
    const { week } = await parseBody(req);

    const classItem = classes.find(c => c.id === classId && c.user_id === decoded.userId);
    if (!classItem) {
      return sendJSON(res, 404, { error: 'Class not found' });
    }

    const cancelledWeeks = JSON.parse(classItem.cancelled_weeks || '[]');
    classItem.cancelled_weeks = JSON.stringify(cancelledWeeks.filter(w => w !== week));
    sendJSON(res, 200, {
      ...classItem,
      is_temporary: !!classItem.is_temporary,
      cancelled_weeks: JSON.parse(classItem.cancelled_weeks)
    });
    return;
  }

  // 404
  sendJSON(res, 404, { error: 'Not found' });
};
