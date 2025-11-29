from flask import Flask, render_template, request, jsonify, session, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import base64
import os
import re
from flask_cors import CORS
import io
import threading
import time
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, time as dt_time
import json  # ADD THIS IMPORT

# Initialize Flask
app = Flask(__name__, 
            static_folder='static',
            static_url_path='/static',
            template_folder='templates')

app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-2024')
CORS(app)

# Database configuration
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://medicine_reminder_db_ydwd_user:MA8YcIJ9c23KnnMaArYbFSfRfA5qYwpd@dpg-d4i9106r433s73c98mv0-a/medicine_reminder_db_ydwd')

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_recycle': 300,
    'pool_pre_ping': True
}

db = SQLAlchemy(app)

# Database Models
class User(db.Model):
    __tablename__ = 'users'
    __table_args__ = {'extend_existing': True}
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    phone = db.Column(db.String(20))
    role = db.Column(db.String(20), default='user')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Medicine(db.Model):
    __tablename__ = 'medicines'
    __table_args__ = {'extend_existing': True}
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    medicine_name = db.Column(db.String(100), nullable=False)
    dosage = db.Column(db.String(100), nullable=False)
    frequency = db.Column(db.String(50), nullable=False)  # daily, weekly, monthly
    schedule_type = db.Column(db.String(20), default='fixed')  # fixed, flexible
    times_per_day = db.Column(db.Integer, default=1)
    specific_times = db.Column(db.Text)  # JSON string of specific times
    start_date = db.Column(db.String(50), nullable=False)
    end_date = db.Column(db.String(50))
    instructions = db.Column(db.Text)
    status = db.Column(db.String(20), default='Active')
    priority = db.Column(db.String(20), default='Medium')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class MedicineLog(db.Model):
    __tablename__ = 'medicine_logs'
    __table_args__ = {'extend_existing': True}
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    medicine_id = db.Column(db.Integer, db.ForeignKey('medicines.id'), nullable=False)
    taken_time = db.Column(db.DateTime, default=datetime.utcnow)
    scheduled_time = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default='Taken')  # Taken, Missed, Skipped
    notes = db.Column(db.Text)

class Notification(db.Model):
    __tablename__ = 'notifications'
    __table_args__ = {'extend_existing': True}
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    medicine_id = db.Column(db.Integer, db.ForeignKey('medicines.id'))
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), default='reminder')
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Initialize database
with app.app_context():
    max_retries = 3
    for attempt in range(max_retries):
        try:
            print(f"🔄 Medicine database initialization attempt {attempt + 1}/{max_retries}")
            
            # Test database connection
            db.session.execute(text('SELECT 1'))
            print("✅ Database connection successful")
            
            # Create all tables
            db.create_all()
            print("✅ Tables created/verified")
            
            # Create admin user if not exists
            admin = User.query.filter_by(email='admin@medicine.com').first()
            if not admin:
                print("🔄 Creating admin user...")
                admin = User(
                    username='admin',
                    password=generate_password_hash('admin123'),
                    email='admin@medicine.com',
                    role='admin'
                )
                db.session.add(admin)
                db.session.commit()
                print("✅ Admin user created successfully!")
            else:
                print(f"✅ Admin user already exists: {admin.username} (role: {admin.role})")
            
            print("✅ Medicine database initialized successfully!")
            break
            
        except Exception as e:
            print(f"❌ Database initialization attempt {attempt + 1} failed: {e}")
            db.session.rollback()
            
            if attempt == max_retries - 1:
                print("💥 All database initialization attempts failed")
                print("🔄 Starting application anyway...")
            import time
            time.sleep(2)

# Routes

scheduler = BackgroundScheduler()

def check_medicine_reminders():
    """Check for due medicines and send notifications based on specific times"""
    with app.app_context():
        try:
            current_time = datetime.utcnow()
            current_time_str = current_time.strftime('%H:%M')
            
            print(f"🔔 Checking reminders at {current_time_str}")
            
            # Get all active medicines
            active_medicines = Medicine.query.filter_by(status='Active').all()
            
            for medicine in active_medicines:
                # Parse specific times if available
                specific_times = []
                if medicine.specific_times:
                    try:
                        specific_times = json.loads(medicine.specific_times)
                    except:
                        specific_times = []
                
                # If no specific times, use default times based on times_per_day
                if not specific_times and medicine.times_per_day:
                    specific_times = generate_default_times(medicine.times_per_day)
                
                # Check if current time matches any scheduled time
                for scheduled_time in specific_times:
                    if is_time_matching(current_time_str, scheduled_time):
                        # Check if we already notified for this medicine at this time today
                        today = current_time.date()
                        existing_notification = Notification.query.filter(
                            Notification.user_id == medicine.user_id,
                            Notification.medicine_id == medicine.id,
                            db.func.date(Notification.created_at) == today,
                            Notification.message.like(f'%{scheduled_time}%')
                        ).first()
                        
                        if not existing_notification:
                            # Create notification
                            notification = Notification(
                                user_id=medicine.user_id,
                                medicine_id=medicine.id,
                                message=f'Time to take {medicine.medicine_name} - {medicine.dosage} at {scheduled_time}',
                                type='reminder'
                            )
                            db.session.add(notification)
                            print(f"✅ Created reminder for {medicine.medicine_name} at {scheduled_time}")
            
            db.session.commit()
            
        except Exception as e:
            print(f"❌ Error checking reminders: {e}")

def generate_default_times(times_per_day):
    """Generate default times based on number of times per day"""
    if times_per_day == 1:
        return ["09:00"]
    elif times_per_day == 2:
        return ["08:00", "20:00"]
    elif times_per_day == 3:
        return ["08:00", "14:00", "20:00"]
    elif times_per_day == 4:
        return ["08:00", "12:00", "16:00", "20:00"]
    else:
        return ["09:00"]  # Default fallback

def is_time_matching(current_time, scheduled_time):
    """Check if current time exactly matches scheduled time"""
    try:
        # Exact minute matching for precise reminders
        return current_time == scheduled_time
    except ValueError:
        return False

def check_medicine_reminders():
    """Check for due medicines and send notifications based on specific times"""
    with app.app_context():
        try:
            current_time = datetime.utcnow()
            current_time_str = current_time.strftime('%H:%M')
            
            print(f"🔔 Checking reminders at {current_time_str}")
            
            # Get all active medicines
            active_medicines = Medicine.query.filter_by(status='Active').all()
            
            for medicine in active_medicines:
                # Parse specific times if available
                specific_times = []
                if medicine.specific_times:
                    try:
                        specific_times = json.loads(medicine.specific_times)
                    except:
                        specific_times = []
                
                # If no specific times, use default times based on times_per_day
                if not specific_times and medicine.times_per_day:
                    specific_times = generate_default_times(medicine.times_per_day)
                
                # Check if current time matches any scheduled time exactly
                for scheduled_time in specific_times:
                    if is_time_matching(current_time_str, scheduled_time):
                        # Check if we already notified for this medicine at this time today
                        today = current_time.date()
                        existing_notification = Notification.query.filter(
                            Notification.user_id == medicine.user_id,
                            Notification.medicine_id == medicine.id,
                            db.func.date(Notification.created_at) == today,
                            Notification.message.like(f'%{scheduled_time}%')
                        ).first()
                        
                        if not existing_notification:
                            # Convert to 12-hour format for notification
                            scheduled_time_12h = convert_to_12h(scheduled_time)
                            
                            # Create notification
                            notification = Notification(
                                user_id=medicine.user_id,
                                medicine_id=medicine.id,
                                message=f'Time to take {medicine.medicine_name} - {medicine.dosage} at {scheduled_time_12h}',
                                type='reminder'
                            )
                            db.session.add(notification)
                            print(f"✅ Created reminder for {medicine.medicine_name} at {scheduled_time_12h}")
            
            db.session.commit()
            
        except Exception as e:
            print(f"❌ Error checking reminders: {e}")

def convert_to_12h(time_24h):
    """Convert 24-hour time to 12-hour format"""
    try:
        hours, minutes = time_24h.split(':')
        hours = int(hours)
        am_pm = 'AM' if hours < 12 else 'PM'
        hours_12 = hours % 12
        if hours_12 == 0:
            hours_12 = 12
        return f"{hours_12}:{minutes} {am_pm}"
    except:
        return time_24h

# New API routes for notifications
@app.route('/api/user_notifications')
def get_user_notifications():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    notifications = Notification.query.filter_by(
        user_id=session['user_id']
    ).order_by(Notification.created_at.desc()).limit(20).all()
    
    notifications_data = []
    for notification in notifications:
        medicine = Medicine.query.get(notification.medicine_id) if notification.medicine_id else None
        notification_data = {
            'id': notification.id,
            'message': notification.message,
            'type': notification.type,
            'is_read': notification.is_read,
            'created_at': notification.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'medicine_name': medicine.medicine_name if medicine else None
        }
        notifications_data.append(notification_data)
    
    return jsonify({'success': True, 'notifications': notifications_data})

@app.route('/api/mark_notification_read/<int:notification_id>', methods=['POST'])
def mark_notification_read(notification_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    try:
        notification = Notification.query.get(notification_id)
        if notification and notification.user_id == session['user_id']:
            notification.is_read = True
            db.session.commit()
            return jsonify({'success': True, 'message': 'Notification marked as read'})
        else:
            return jsonify({'success': False, 'message': 'Notification not found'})
    except Exception as e:
        return jsonify({'success': False, 'message': 'Error updating notification'})

@app.route('/api/set_reminder_time', methods=['POST'])
def set_reminder_time():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    try:
        data = request.get_json()
        reminder_time = data.get('reminder_time', '09:00')  # Default to 9 AM
        
        # Store user's preferred reminder time (you might want to add this to User model)
        # For now, we'll use session
        session['reminder_time'] = reminder_time
        
        return jsonify({'success': True, 'message': f'Reminder time set to {reminder_time}'})
    except Exception as e:
        return jsonify({'success': False, 'message': 'Error setting reminder time'})

@app.route('/api/add_medicine', methods=['POST'])
def add_medicine():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Please login first!'})
    
    try:
        data = request.get_json()
        
        # Handle specific times
        specific_times = data.get('specific_times')
        if specific_times and isinstance(specific_times, list):
            specific_times = json.dumps(specific_times)
        else:
            specific_times = None
        
        medicine = Medicine(
            user_id=session['user_id'],
            medicine_name=data.get('medicine_name'),
            dosage=data.get('dosage'),
            frequency=data.get('frequency', 'daily'),
            schedule_type=data.get('schedule_type', 'fixed'),
            times_per_day=data.get('times_per_day', 1),
            specific_times=specific_times,
            start_date=data.get('start_date'),
            end_date=data.get('end_date'),
            instructions=data.get('instructions'),
            priority=data.get('priority', 'Medium')
        )
        db.session.add(medicine)
        db.session.commit()
        
        # Create notification
        notification = Notification(
            user_id=session['user_id'],
            medicine_id=medicine.id,
            message=f'Medicine "{medicine.medicine_name}" added successfully!',
            type='medicine_added'
        )
        db.session.add(notification)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Medicine added successfully!'})
    except Exception as e:
        print(f"Error adding medicine: {e}")
        return jsonify({'success': False, 'message': 'Failed to add medicine'})

@app.route('/api/user_medicines')
def get_user_medicines():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    medicines = Medicine.query.filter_by(user_id=session['user_id']).order_by(Medicine.created_at.desc()).all()
    medicines_data = []
    for medicine in medicines:
        # Get today's logs for this medicine
        today = datetime.utcnow().date()
        today_logs = MedicineLog.query.filter(
            MedicineLog.medicine_id == medicine.id,
            db.func.date(MedicineLog.taken_time) == today
        ).all()
        
        medicine_data = {
            'id': medicine.id,
            'medicine_name': medicine.medicine_name,
            'dosage': medicine.dosage,
            'frequency': medicine.frequency,
            'schedule_type': medicine.schedule_type,
            'times_per_day': medicine.times_per_day,
            'specific_times': medicine.specific_times,
            'start_date': medicine.start_date,
            'end_date': medicine.end_date,
            'instructions': medicine.instructions,
            'status': medicine.status,
            'priority': medicine.priority,
            'created_at': medicine.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'today_taken': len([log for log in today_logs if log.status == 'Taken']),
            'today_missed': len([log for log in today_logs if log.status == 'Missed'])
        }
        medicines_data.append(medicine_data)
    
    return jsonify({'success': True, 'medicines': medicines_data})

@app.route('/api/log_medicine', methods=['POST'])
def log_medicine():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Please login first!'})
    
    try:
        data = request.get_json()
        medicine_log = MedicineLog(
            user_id=session['user_id'],
            medicine_id=data.get('medicine_id'),
            scheduled_time=data.get('scheduled_time'),
            status=data.get('status', 'Taken'),
            notes=data.get('notes')
        )
        db.session.add(medicine_log)
        db.session.commit()
        
        medicine = Medicine.query.get(data.get('medicine_id'))
        if medicine:
            notification = Notification(
                user_id=session['user_id'],
                medicine_id=medicine.id,
                message=f'Medicine "{medicine.medicine_name}" marked as {data.get("status", "Taken")}',
                type='medicine_taken'
            )
            db.session.add(notification)
            db.session.commit()
        
        return jsonify({'success': True, 'message': 'Medicine logged successfully!'})
    except Exception as e:
        print(f"Error logging medicine: {e}")
        return jsonify({'success': False, 'message': 'Failed to log medicine'})

@app.route('/api/medicine_history')
def get_medicine_history():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    logs = MedicineLog.query.filter_by(user_id=session['user_id']).order_by(MedicineLog.taken_time.desc()).limit(50).all()
    logs_data = []
    for log in logs:
        medicine = Medicine.query.get(log.medicine_id)
        log_data = {
            'id': log.id,
            'medicine_name': medicine.medicine_name if medicine else 'Unknown',
            'dosage': medicine.dosage if medicine else '',
            'scheduled_time': log.scheduled_time,
            'taken_time': log.taken_time.strftime('%Y-%m-%d %H:%M:%S'),
            'status': log.status,
            'notes': log.notes
        }
        logs_data.append(log_data)
    
    return jsonify({'success': True, 'history': logs_data})

@app.route('/api/stats')
def get_stats():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    user_id = session['user_id']
    role = session.get('role', 'user')
    
    if role == 'admin':
        total_medicines = Medicine.query.count()
        active_medicines = Medicine.query.filter_by(status='Active').count()
        total_users = User.query.count()
        
        # Today's stats
        today = datetime.utcnow().date()
        today_taken = MedicineLog.query.filter(
            db.func.date(MedicineLog.taken_time) == today,
            MedicineLog.status == 'Taken'
        ).count()
        today_missed = MedicineLog.query.filter(
            db.func.date(MedicineLog.taken_time) == today,
            MedicineLog.status == 'Missed'
        ).count()
        
        stats = {
            'total_medicines': total_medicines,
            'active_medicines': active_medicines,
            'total_users': total_users,
            'today_taken': today_taken,
            'today_missed': today_missed
        }
    else:
        my_medicines = Medicine.query.filter_by(user_id=user_id).count()
        active_medicines = Medicine.query.filter_by(user_id=user_id, status='Active').count()
        
        # Today's personal stats
        today = datetime.utcnow().date()
        today_taken = MedicineLog.query.filter(
            MedicineLog.user_id == user_id,
            db.func.date(MedicineLog.taken_time) == today,
            MedicineLog.status == 'Taken'
        ).count()
        today_missed = MedicineLog.query.filter(
            MedicineLog.user_id == user_id,
            db.func.date(MedicineLog.taken_time) == today,
            MedicineLog.status == 'Missed'
        ).count()
        
        stats = {
            'my_medicines': my_medicines,
            'active_medicines': active_medicines,
            'today_taken': today_taken,
            'today_missed': today_missed
        }
    
    return jsonify({'success': True, 'stats': stats})

@app.route('/api/upcoming_reminders')
def get_upcoming_reminders():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    # Get active medicines for the user
    active_medicines = Medicine.query.filter_by(
        user_id=session['user_id'], 
        status='Active'
    ).all()
    
    reminders = []
    current_time = datetime.utcnow()
    
    for medicine in active_medicines:
        # Simple reminder logic - you can enhance this based on schedule_type and specific_times
        reminder = {
            'medicine_id': medicine.id,
            'medicine_name': medicine.medicine_name,
            'dosage': medicine.dosage,
            'instructions': medicine.instructions,
            'priority': medicine.priority,
            'next_reminder': 'Soon'  # You can implement more sophisticated scheduling
        }
        reminders.append(reminder)
    
    return jsonify({'success': True, 'reminders': reminders})

# Authentication routes (same as community care)
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        print(f"🔐 Login attempt for: {email}")
        
        if not email or not password:
            return jsonify({
                'success': False,
                'message': 'Email and password are required!'
            })
        
        user = User.query.filter_by(email=email).first()
        
        if user:
            print(f"📋 User found: {user.username}, Role: {user.role}")
            if check_password_hash(user.password, password):
                session['user_id'] = user.id
                session['username'] = user.username
                session['role'] = user.role
                session['email'] = user.email
                
                print(f"✅ Login successful: {user.username} (role: {user.role})")
                
                return jsonify({
                    'success': True,
                    'message': f'Welcome back, {user.username}!',
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'role': user.role,
                        'email': user.email
                    }
                })
            else:
                print("❌ Invalid password")
                return jsonify({
                    'success': False,
                    'message': 'Invalid email or password!'
                })
        else:
            print("❌ User not found")
            return jsonify({
                'success': False,
                'message': 'Invalid email or password!'
            })
            
    except Exception as e:
        print(f"💥 Login error: {e}")
        return jsonify({
            'success': False,
            'message': 'Login failed. Please try again.'
        })

@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        confirm_password = data.get('confirm_password')
        
        if not all([username, email, password, confirm_password]):
            return jsonify({'success': False, 'message': 'Please fill in all required fields!'})
        
        if password != confirm_password:
            return jsonify({'success': False, 'message': 'Passwords do not match!'})
        
        # Check if user already exists
        if User.query.filter_by(email=email).first():
            return jsonify({'success': False, 'message': 'Email already exists!'})
        
        new_user = User(
            username=username,
            email=email,
            password=generate_password_hash(password)
        )
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Account created successfully!'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': 'Error creating account!'})

@app.route('/api/user_info')
def get_user_info():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    return jsonify({
        'success': True,
        'user': {
            'id': session.get('user_id'),
            'username': session.get('username'),
            'role': session.get('role'),
            'email': session.get('email')
        }
    })

@app.route('/api/logout')
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully!'})

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)

