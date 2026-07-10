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
        conn.execute('''
            CREATE TABLE IF NOT EXISTS daily_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT,
                food_name TEXT,
                calories REAL,
                protein REAL,
                carbs REAL,
                fats REAL
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

def _generate_session_title(message: str) -> str:
    """Generate a short, descriptive title from the first chat message."""
    message = message.strip().lower()
    # Map common nutrition query patterns to concise, readable titles
    patterns = [
        (["breakfast", "morning"], "Breakfast Ideas"),
        (["lunch"], "Lunch Suggestions"),
        (["dinner", "evening meal"], "Dinner Planning"),
        (["snack"], "Healthy Snacks"),
        (["meal plan", "weekly plan", "7 day", "week"], "Meal Plan Request"),
        (["protein", "high protein"], "High Protein Diet"),
        (["weight loss", "lose weight", "fat loss"], "Weight Loss Plan"),
        (["weight gain", "gain weight", "bulk"], "Weight Gain Plan"),
        (["muscle", "build muscle", "gym"], "Muscle Building"),
        (["diabetes", "sugar", "blood sugar"], "Diabetes Nutrition"),
        (["heart", "cholesterol"], "Heart Health"),
        (["vegetarian", "vegan"], "Vegetarian Diet"),
        (["calories", "calorie count"], "Calorie Tracking"),
        (["bmi", "body mass"], "BMI Calculation"),
        (["recipe"], "Recipe Request"),
        (["grocery", "shopping"], "Grocery List"),
        (["family", "kids", "children"], "Family Nutrition"),
        (["indian", "roti", "dal", "curry", "biryani", "sabzi"], "Indian Food Guide"),
        (["analyze", "analysis", "nutrition info"], "Meal Analysis"),
    ]
    for keywords, title in patterns:
        if any(kw in message for kw in keywords):
            return title
    # Fallback: trim to 32 chars, capitalize, clean up
    raw = message[:32].strip()
    raw = raw[0].upper() + raw[1:] if raw else "New Chat"
    if len(message) > 32:
        raw += "..."
    return raw


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
                title = _generate_session_title(content)
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
        cursor = conn.execute('SELECT id FROM progress_history WHERE date = ?', (date,))
        row = cursor.fetchone()
        if row:
            conn.execute('UPDATE progress_history SET weight = ?, bmi = ? WHERE id = ?', (weight, bmi, row['id']))
        else:
            conn.execute('INSERT INTO progress_history (weight, bmi, date) VALUES (?, ?, ?)', (weight, bmi, date))
    conn.close()

def get_progress():
    conn = get_db()
    cursor = conn.execute('SELECT weight, bmi, date FROM progress_history ORDER BY date ASC, id ASC')
    progress = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return progress

def add_daily_log(food_name, calories, protein, carbs, fats, date=None):
    if date is None:
        date = datetime.now(timezone.utc).date().isoformat()
    conn = get_db()
    with conn:
        conn.execute(
            'INSERT INTO daily_logs (date, food_name, calories, protein, carbs, fats) VALUES (?, ?, ?, ?, ?, ?)',
            (date, food_name, calories, protein, carbs, fats)
        )
    conn.close()

def get_daily_logs(date=None):
    if date is None:
        date = datetime.now(timezone.utc).date().isoformat()
    conn = get_db()
    cursor = conn.execute(
        'SELECT id, food_name, calories, protein, carbs, fats FROM daily_logs WHERE date = ? ORDER BY id ASC',
        (date,)
    )
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return logs
