import sqlite3
import uuid
from datetime import datetime, timezone
import os

DB_PATH = 'chats.db'

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    with conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                role TEXT,
                content TEXT,
                created_at TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS progress_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                weight REAL,
                bmi REAL,
                date TEXT
            )
        ''')
    conn.close()

def create_session(title="New Chat"):
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    with conn:
        conn.execute(
            'INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
            (session_id, title, now, now)
        )
    conn.close()
    return session_id

def get_all_sessions():
    conn = get_db()
    cursor = conn.execute('SELECT id, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC')
    sessions = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return sessions

def get_session_messages(session_id):
    conn = get_db()
    cursor = conn.execute('SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC', (session_id,))
    messages = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return messages

def add_message(session_id, role, content):
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    with conn:
        conn.execute(
            'INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)',
            (session_id, role, content, now)
        )
        # Generate title if this is the first user message
        if role == 'user':
            cursor = conn.execute('SELECT title FROM sessions WHERE id = ?', (session_id,))
            row = cursor.fetchone()
            if row and row['title'] == "New Chat":
                # Create a short title from the first message
                title = (content[:30] + '...') if len(content) > 30 else content
                conn.execute('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?', (title, now, session_id))
            else:
                conn.execute('UPDATE sessions SET updated_at = ? WHERE id = ?', (now, session_id))
    conn.close()

def delete_session(session_id):
    conn = get_db()
    with conn:
        conn.execute('DELETE FROM sessions WHERE id = ?', (session_id,))
    conn.close()

def add_progress(weight, bmi, date=None):
    if date is None:
        date = datetime.now(timezone.utc).date().isoformat()
    conn = get_db()
    with conn:
        conn.execute(
            'INSERT INTO progress_history (weight, bmi, date) VALUES (?, ?, ?)',
            (weight, bmi, date)
        )
    conn.close()

def get_progress():
    conn = get_db()
    cursor = conn.execute('SELECT weight, bmi, date FROM progress_history ORDER BY date ASC, id ASC')
    progress = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return progress
