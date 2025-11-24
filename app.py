from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import datetime
import json
import psycopg
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Database connection
def get_db_connection():
    database_url = os.getenv('DATABASE_URL')
    
    if database_url:
        # Parse the database URL for Render
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        
        conn = psycopg.connect(database_url)
    else:
        # Fallback to individual environment variables (for local development)
        conn = psycopg.connect(
            host=os.getenv('DB_HOST'),
            dbname=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=os.getenv('DB_PORT')
        )
    return conn

# The rest of your app.py code remains the same...

# Initialize database tables
def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Create users table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create medicines table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS medicines (
            medicine_id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(user_id),
            medicine_name VARCHAR(100) NOT NULL,
            dosage VARCHAR(50) NOT NULL,
            instructions TEXT,
            start_time VARCHAR(20) NOT NULL,
            status VARCHAR(20) DEFAULT 'Pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    cur.close()
    conn.close()

@app.route('/api/user', methods=['POST'])
def get_or_create_user():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Check if user exists
    cur.execute('SELECT * FROM users WHERE email = %s', (email,))
    user = cur.fetchone()
    
    if user:
        user_data = {
            'user_id': user[0],
            'name': user[1],
            'email': user[2]
        }
        cur.close()
        conn.close()
        return jsonify(user_data)
    else:
        # Create new user
        cur.execute(
            'INSERT INTO users (name, email) VALUES (%s, %s) RETURNING user_id',
            (name, email)
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        
        user_data = {
            'user_id': user_id,
            'name': name,
            'email': email
        }
        cur.close()
        conn.close()
        return jsonify(user_data)

@app.route('/api/medicine', methods=['POST'])
def add_medicine():
    data = request.get_json()
    user_id = data.get('user_id')
    medicine_name = data.get('medicine_name')
    dosage = data.get('dosage')
    instructions = data.get('instructions')
    start_time = data.get('start_time')
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute('''
        INSERT INTO medicines (user_id, medicine_name, dosage, instructions, start_time)
        VALUES (%s, %s, %s, %s, %s) RETURNING medicine_id
    ''', (user_id, medicine_name, dosage, instructions, start_time))
    
    medicine_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({'message': 'Medicine added successfully', 'medicine_id': medicine_id})

@app.route('/api/schedule', methods=['GET'])
def view_schedule():
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute('''
        SELECT m.medicine_id, m.medicine_name, m.dosage, m.instructions, 
               m.start_time, m.status, u.name as user_name
        FROM medicines m
        JOIN users u ON m.user_id = u.user_id
        ORDER BY m.created_at DESC
    ''')
    
    schedules = []
    for row in cur.fetchall():
        schedule = {
            'medicine_id': row[0],
            'medicine_name': row[1],
            'dosage': row[2],
            'instructions': row[3],
            'start_time': row[4],
            'status': row[5],
            'user_name': row[6]
        }
        schedules.append(schedule)
    
    cur.close()
    conn.close()
    return jsonify(schedules)

@app.route('/api/history/<int:user_id>', methods=['GET'])
def view_history(user_id):
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute('''
        SELECT medicine_id, medicine_name, dosage, instructions, start_time, status
        FROM medicines 
        WHERE user_id = %s AND status = 'Taken'
        ORDER BY created_at DESC
    ''', (user_id,))
    
    history = []
    for row in cur.fetchall():
        medicine = {
            'medicine_id': row[0],
            'medicine_name': row[1],
            'dosage': row[2],
            'instructions': row[3],
            'start_time': row[4],
            'status': row[5]
        }
        history.append(medicine)
    
    cur.close()
    conn.close()
    return jsonify(history)

@app.route('/api/reminder/check', methods=['GET'])
def check_reminder():
    current_time = datetime.datetime.now().strftime("%I:%M %p")
    today = datetime.date.today()
    formatted_date = today.strftime("%B %d, %Y")
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute('''
        SELECT medicine_id, medicine_name, dosage, instructions, start_time
        FROM medicines 
        WHERE status = 'Pending'
    ''')
    
    reminders = []
    for row in cur.fetchall():
        medicine_id, medicine_name, dosage, instructions, med_time = row
        
        med_dt = datetime.datetime.strptime(med_time, "%I:%M %p")
        current_dt = datetime.datetime.strptime(current_time, "%I:%M %p")
        
        if current_dt >= med_dt:
            # Update status to Taken
            cur.execute('''
                UPDATE medicines SET status = 'Taken' WHERE medicine_id = %s
            ''', (medicine_id,))
            
            reminder = {
                'medicine_id': medicine_id,
                'medicine_name': medicine_name,
                'dosage': dosage,
                'instructions': instructions,
                'time': med_time,
                'date': formatted_date
            }
            reminders.append(reminder)
    
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify(reminders)

@app.route('/api/medicine/<int:medicine_id>/taken', methods=['PUT'])
def mark_medicine_taken(medicine_id):
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute('''
        UPDATE medicines SET status = 'Taken' WHERE medicine_id = %s
    ''', (medicine_id,))
    
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({'message': 'Medicine marked as taken'})

@app.route('/')
def serve_frontend():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

