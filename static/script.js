// Global variables
let currentUser = null;

// Add to global variables
let notificationSound = null;
let reminderInterval = null;

// Add to DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    console.log('Medicine Reminder App Initialized');
    
    // Set current date for start date field
    const startDateField = document.getElementById('start-date');
    if (startDateField) {
        startDateField.valueAsDate = new Date();
    }
    
    // Initialize notification sound
    initializeNotificationSound();
    
    // Check authentication status immediately
    checkAuthStatus();
    setupEventListeners();
    
    // Start reminder checking
    startReminderChecking();
});

// Initialize notification sound
function initializeNotificationSound() {
    try {
        // Create a simple beep sound using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        notificationSound = audioContext;
        console.log('🔊 Notification sound initialized');
    } catch (error) {
        console.warn('🔇 Web Audio API not supported, using fallback');
        notificationSound = 'fallback';
    }
}

// Play notification sound
function playNotificationSound() {
    if (!notificationSound) return;
    
    try {
        if (notificationSound === 'fallback') {
            // Fallback: Use browser's built-in beep
            console.log('\x07'); // ASCII bell character
        } else {
            // Web Audio API beep
            const oscillator = notificationSound.createOscillator();
            const gainNode = notificationSound.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(notificationSound.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, notificationSound.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, notificationSound.currentTime + 1);
            
            oscillator.start(notificationSound.currentTime);
            oscillator.stop(notificationSound.currentTime + 1);
        }
    } catch (error) {
        console.warn('Could not play notification sound:', error);
    }
}

// Start checking for reminders
function startReminderChecking() {
    // Check every minute for due reminders
    reminderInterval = setInterval(async () => {
        if (currentUser) {
            await checkDueReminders();
        }
    }, 60000); // Check every minute
    
    // Also check immediately
    if (currentUser) {
        setTimeout(() => checkDueReminders(), 2000);
    }
}

// Check for due reminders
async function checkDueReminders() {
    try {
        const response = await fetch('/api/upcoming_reminders');
        const data = await response.json();
        
        if (data.success && data.reminders.length > 0) {
            const currentTime = new Date();
            const currentHour = currentTime.getHours();
            const currentMinute = currentTime.getMinutes();
            
            // Check if it's reminder time (9 AM by default)
            if (currentHour === 9 && currentMinute === 0) {
                showMedicineReminder(data.reminders);
            }
            
            // Also check for unread notifications
            await checkUnreadNotifications();
        }
    } catch (error) {
        console.error('Error checking reminders:', error);
    }
}

// Show medicine reminder notification
function showMedicineReminder(reminders) {
    if (reminders.length === 0) return;
    
    // Play sound
    playNotificationSound();
    
    // Show browser notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
        const medicineNames = reminders.map(r => r.medicine_name).join(', ');
        new Notification('Medicine Reminder', {
            body: `Time to take your medicines: ${medicineNames}`,
            icon: '/static/icon-192.png',
            tag: 'medicine-reminder'
        });
    }
    
    // Show in-app notification
    showSnackbar(`💊 Time to take your medicines!`, 'warning');
    
    // Update reminders list
    loadUpcomingReminders();
}

// Check for unread notifications
async function checkUnreadNotifications() {
    try {
        const response = await fetch('/api/user_notifications');
        const data = await response.json();
        
        if (data.success) {
            const unreadNotifications = data.notifications.filter(n => !n.is_read);
            
            if (unreadNotifications.length > 0) {
                // Show notification badge
                updateNotificationBadge(unreadNotifications.length);
                
                // Show latest unread notification
                const latestNotification = unreadNotifications[0];
                if (!sessionStorage.getItem(`notification_${latestNotification.id}_shown`)) {
                    showSnackbar(latestNotification.message, 'info');
                    sessionStorage.setItem(`notification_${latestNotification.id}_shown`, 'true');
                }
            } else {
                updateNotificationBadge(0);
            }
        }
    } catch (error) {
        console.error('Error checking notifications:', error);
    }
}

// Update notification badge
function updateNotificationBadge(count) {
    let badge = document.getElementById('notification-badge');
    
    if (count > 0) {
        if (!badge) {
            // Create badge if it doesn't exist
            const dropdownBtn = document.querySelector('.dropdown-btn');
            if (dropdownBtn) {
                badge = document.createElement('span');
                badge.id = 'notification-badge';
                badge.className = 'notification-badge';
                dropdownBtn.appendChild(badge);
            }
        }
        badge.textContent = count > 9 ? '9+' : count.toString();
        badge.style.display = 'flex';
    } else if (badge) {
        badge.style.display = 'none';
    }
}

// Add notification section to user dashboard
async function loadUserNotifications() {
    try {
        const response = await fetch('/api/user_notifications');
        const data = await response.json();
        
        const notificationsList = document.getElementById('notifications-list');
        if (!notificationsList) return;
        
        if (data.success && data.notifications.length > 0) {
            notificationsList.innerHTML = data.notifications.map(notification => `
                <div class="notification-card ${notification.is_read ? 'read' : 'unread'}">
                    <div class="notification-header">
                        <span class="notification-message">${notification.message}</span>
                        <span class="notification-time">${notification.created_at}</span>
                    </div>
                    ${notification.medicine_name ? `
                        <div class="notification-medicine">
                            <i class="fas fa-pills"></i> ${notification.medicine_name}
                        </div>
                    ` : ''}
                    ${!notification.is_read ? `
                        <div class="notification-actions">
                            <button class="btn btn-sm" onclick="markNotificationAsRead(${notification.id})">
                                <i class="fas fa-check"></i> Mark as Read
                            </button>
                        </div>
                    ` : ''}
                </div>
            `).join('');
        } else {
            notificationsList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #64748b;">
                    <p>No notifications</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
}

// Mark notification as read
async function markNotificationAsRead(notificationId) {
    try {
        const response = await fetch(`/api/mark_notification_read/${notificationId}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadUserNotifications();
            await checkUnreadNotifications();
        }
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
    }
}

// Update loadUserDashboard function
async function loadUserDashboard() {
    if (!currentUser) return;
    
    document.getElementById('user-name').textContent = currentUser.username;
    await loadStats();
    await loadUserMedicines();
    await loadUpcomingReminders();
    await loadUserNotifications(); // Add this line
    
    // Request notification permission
    requestNotificationPermission();
}

// Request browser notification permission
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            console.log('Notification permission:', permission);
        });
    }
}

// Add to setupEventListeners function
function setupEventListeners() {
    // ... existing code ...
    
    // Notification bell click
    const notificationBell = document.getElementById('notification-bell');
    if (notificationBell) {
        notificationBell.addEventListener('click', function() {
            showScreen('notifications-screen');
        });
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('Medicine Reminder App Initialized');
    
    // Set current date for start date field
    const startDateField = document.getElementById('start-date');
    if (startDateField) {
        startDateField.valueAsDate = new Date();
    }
    
    // Check authentication status immediately
    checkAuthStatus();
    setupEventListeners();
});

// Event listeners
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Medicine form
    const medicineForm = document.getElementById('medicine-form');
    if (medicineForm) {
        medicineForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleMedicineSubmit(e);
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('user-dropdown');
        const dropdownBtn = document.querySelector('.dropdown-btn');
        
        if (dropdown && dropdownBtn && !dropdownBtn.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.classList.add('hidden');
            dropdownBtn.classList.remove('active');
        }
    });
}

// Medicine functions
async function handleMedicineSubmit(e) {
    e.preventDefault();
    
    console.log('🔍 Medicine form submitted - Starting validation');
    
    if (!currentUser) {
        showSnackbar('Please login first!', 'error');
        return;
    }
    
    // Get form values
    const medicineName = document.getElementById('medicine-name').value;
    const dosage = document.getElementById('dosage').value;
    const frequency = document.getElementById('frequency').value;
    const scheduleType = document.getElementById('schedule-type').value;
    const timesPerDay = document.getElementById('times-per-day').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const instructions = document.getElementById('instructions').value;
    const priority = document.getElementById('priority').value;
    
    console.log('📋 Form data:', { 
        medicineName, dosage, frequency, scheduleType, 
        timesPerDay, startDate, endDate, instructions, priority 
    });
    
    // Validate form
    if (!validateMedicineForm()) {
        return;
    }
    
    try {
        // Show loading state
        const submitBtn = document.getElementById('submit-medicine-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        submitBtn.disabled = true;
        
        console.log('📤 Adding medicine to server...');
        
        const response = await fetch('/api/add_medicine', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                medicine_name: medicineName,
                dosage: dosage,
                frequency: frequency,
                schedule_type: scheduleType,
                times_per_day: parseInt(timesPerDay),
                start_date: startDate,
                end_date: endDate || null,
                instructions: instructions,
                priority: priority
            })
        });
        
        const data = await response.json();
        console.log('✅ Add medicine response:', data);
        
        if (data.success) {
            showSnackbar('Medicine added successfully!');
            // Reset form
            document.getElementById('medicine-form').reset();
            // Set current date for start date
            document.getElementById('start-date').valueAsDate = new Date();
            // Refresh stats and medicines
            await loadStats();
            await loadUserMedicines();
            console.log('🔄 Stats and medicines refreshed');
        } else {
            console.error('❌ Medicine addition failed:', data.message);
            showSnackbar(data.message || 'Failed to add medicine', 'error');
        }
    } catch (error) {
        console.error('💥 Medicine addition error:', error);
        showSnackbar('Failed to add medicine. Please try again.', 'error');
    } finally {
        // Reset button state
        const submitBtn = document.getElementById('submit-medicine-btn');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Medicine';
            submitBtn.disabled = false;
        }
    }
}

function validateMedicineForm() {
    const medicineName = document.getElementById('medicine-name').value;
    const dosage = document.getElementById('dosage').value;
    const startDate = document.getElementById('start-date').value;
    
    if (!medicineName.trim()) {
        showSnackbar('Please enter medicine name', 'error');
        document.getElementById('medicine-name').focus();
        return false;
    }
    
    if (!dosage.trim()) {
        showSnackbar('Please enter dosage', 'error');
        document.getElementById('dosage').focus();
        return false;
    }
    
    if (!startDate) {
        showSnackbar('Please select start date', 'error');
        document.getElementById('start-date').focus();
        return false;
    }
    
    return true;
}

// Authentication functions
async function checkAuthStatus() {
    try {
        console.log('Checking auth status...');
        const response = await fetch('/api/user_info');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Auth response:', data);
        
        if (data.success) {
            currentUser = data.user;
            
            if (currentUser.role === 'admin') {
                showScreen('admin-dashboard');
                loadAdminDashboard();
            } else {
                showScreen('user-dashboard');
                loadUserDashboard();
            }
        } else {
            console.log('Not logged in, showing login screen');
            showScreen('login-screen');
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showScreen('login-screen');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    console.log('Login form submitted');
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showSnackbar('Please fill in all fields', 'error');
        return;
    }
    
    try {
        showSnackbar('Logging in...');
        console.log(`Attempting login for: ${email}`);
        
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        console.log('Login response:', data);
        
        if (data.success) {
            currentUser = data.user;
            console.log(`Login successful! User role: ${currentUser.role}`);
            
            if (currentUser.role === 'admin') {
                console.log('Redirecting to admin dashboard...');
                showScreen('admin-dashboard');
                await loadAdminDashboard();
            } else {
                console.log('Redirecting to user dashboard...');
                showScreen('user-dashboard');
                await loadUserDashboard();
            }
            showSnackbar('Login successful!');
        } else {
            console.error('Login failed:', data.message);
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showSnackbar('Login failed. Please try again.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    console.log('Register form submitted');
    
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const phone = document.getElementById('register-phone').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    if (!username || !email || !password || !confirmPassword) {
        showSnackbar('Please fill in all required fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showSnackbar('Passwords do not match', 'error');
        return;
    }
    
    try {
        showSnackbar('Creating account...');
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username,
                email,
                phone,
                password,
                confirm_password: confirmPassword
            })
        });
        
        const data = await response.json();
        console.log('Register response:', data);
        
        if (data.success) {
            showSnackbar('Account created successfully!');
            showScreen('login-screen');
            document.getElementById('register-form').reset();
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showSnackbar('Registration failed. Please try again.', 'error');
    }
}

async function logout() {
    try {
        const response = await fetch('/api/logout');
        const data = await response.json();
        
        if (data.success) {
            currentUser = null;
            showScreen('login-screen');
            showSnackbar('Logged out successfully!');
        }
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// Dashboard functions
async function loadUserDashboard() {
    if (!currentUser) return;
    
    document.getElementById('user-name').textContent = currentUser.username;
    await loadStats();
    await loadUserMedicines();
    await loadUpcomingReminders();
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            if (currentUser.role === 'admin') {
                document.getElementById('total-medicines').textContent = stats.total_medicines;
                document.getElementById('active-medicines').textContent = stats.active_medicines;
                document.getElementById('total-users').textContent = stats.total_users;
                document.getElementById('today-taken').textContent = stats.today_taken;
                document.getElementById('today-missed').textContent = stats.today_missed;
            } else {
                document.getElementById('my-medicines').textContent = stats.my_medicines;
                document.getElementById('active-medicines').textContent = stats.active_medicines;
                document.getElementById('today-taken').textContent = stats.today_taken;
                document.getElementById('today-missed').textContent = stats.today_missed;
            }
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadUserMedicines() {
    try {
        const response = await fetch('/api/user_medicines');
        const data = await response.json();
        
        const medicinesList = document.getElementById('medicines-list');
        
        if (data.success && data.medicines.length > 0) {
            medicinesList.innerHTML = data.medicines.map(medicine => `
                <div class="medicine-card">
                    <div class="medicine-header">
                        <span class="medicine-name">${medicine.medicine_name}</span>
                        <span class="medicine-status status-${medicine.status.toLowerCase()}">
                            ${medicine.status}
                        </span>
                    </div>
                    <div class="medicine-dosage">
                        <i class="fas fa-pills"></i> ${medicine.dosage}
                    </div>
                    <div class="medicine-schedule">
                        <i class="fas fa-calendar"></i> ${medicine.frequency} • ${medicine.schedule_type}
                    </div>
                    ${medicine.instructions ? `
                        <div class="medicine-instructions">
                            <i class="fas fa-info-circle"></i> ${medicine.instructions}
                        </div>
                    ` : ''}
                    <div class="medicine-footer">
                        <span>Started: ${medicine.start_date}</span>
                        <span class="priority-${medicine.priority.toLowerCase()}">${medicine.priority}</span>
                    </div>
                    <div class="today-stats">
                        <div class="stat-taken">
                            <i class="fas fa-check-circle"></i>
                            Taken: ${medicine.today_taken}
                        </div>
                        <div class="stat-missed">
                            <i class="fas fa-times-circle"></i>
                            Missed: ${medicine.today_missed}
                        </div>
                    </div>
                    <div class="medicine-actions">
                        <button class="btn btn-success" onclick="logMedicineTaken(${medicine.id})">
                            <i class="fas fa-check"></i> Taken
                        </button>
                        <button class="btn btn-warning" onclick="logMedicineMissed(${medicine.id})">
                            <i class="fas fa-times"></i> Missed
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            medicinesList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                    <i class="fas fa-pills" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>No medicines added yet</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load medicines:', error);
        showSnackbar('Failed to load medicines', 'error');
    }
}

async function loadUpcomingReminders() {
    try {
        const response = await fetch('/api/upcoming_reminders');
        const data = await response.json();
        
        const remindersList = document.getElementById('reminders-list');
        
        if (data.success && data.reminders.length > 0) {
            remindersList.innerHTML = data.reminders.map(reminder => `
                <div class="reminder-card">
                    <div class="reminder-header">
                        <span class="reminder-medicine">${reminder.medicine_name}</span>
                        <span class="reminder-priority priority-${reminder.priority.toLowerCase()}">
                            ${reminder.priority}
                        </span>
                    </div>
                    <div class="reminder-dosage">
                        <i class="fas fa-pills"></i> ${reminder.dosage}
                    </div>
                    ${reminder.instructions ? `
                        <div class="reminder-instructions">
                            <i class="fas fa-info-circle"></i> ${reminder.instructions}
                        </div>
                    ` : ''}
                    <div class="reminder-time">
                        <i class="fas fa-clock"></i> Next: ${reminder.next_reminder}
                    </div>
                    <div class="reminder-actions">
                        <button class="btn btn-primary" onclick="logMedicineTaken(${reminder.medicine_id})">
                            <i class="fas fa-check"></i> Mark Taken
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            remindersList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #64748b;">
                    <p>No upcoming reminders</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load reminders:', error);
    }
}

async function logMedicineTaken(medicineId) {
    try {
        const response = await fetch('/api/log_medicine', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                medicine_id: medicineId,
                scheduled_time: new Date().toLocaleTimeString(),
                status: 'Taken',
                notes: 'Marked as taken'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSnackbar('Medicine marked as taken!');
            await loadStats();
            await loadUserMedicines();
            await loadUpcomingReminders();
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Failed to log medicine:', error);
        showSnackbar('Failed to log medicine', 'error');
    }
}

async function logMedicineMissed(medicineId) {
    try {
        const response = await fetch('/api/log_medicine', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                medicine_id: medicineId,
                scheduled_time: new Date().toLocaleTimeString(),
                status: 'Missed',
                notes: 'Marked as missed'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSnackbar('Medicine marked as missed!');
            await loadStats();
            await loadUserMedicines();
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Failed to log medicine:', error);
        showSnackbar('Failed to log medicine', 'error');
    }
}

function showMedicineHistory() {
    showScreen('medicine-history-screen');
    loadMedicineHistory();
}

async function loadMedicineHistory() {
    try {
        const response = await fetch('/api/medicine_history');
        const data = await response.json();
        
        const historyList = document.getElementById('history-list');
        
        if (data.success && data.history.length > 0) {
            historyList.innerHTML = data.history.map(log => `
                <div class="history-card">
                    <div class="history-header">
                        <span class="history-medicine">${log.medicine_name}</span>
                        <span class="history-status status-${log.status.toLowerCase()}">
                            ${log.status}
                        </span>
                    </div>
                    <div class="history-details">
                        <div class="history-dosage">
                            <i class="fas fa-pills"></i> ${log.dosage}
                        </div>
                        <div class="history-time">
                            <i class="fas fa-clock"></i> Scheduled: ${log.scheduled_time}
                        </div>
                        <div class="history-taken">
                            <i class="fas fa-check-circle"></i> Taken: ${log.taken_time}
                        </div>
                        ${log.notes ? `
                            <div class="history-notes">
                                <i class="fas fa-sticky-note"></i> ${log.notes}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        } else {
            historyList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                    <i class="fas fa-history" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>No medicine history yet</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load history:', error);
        showSnackbar('Failed to load history', 'error');
    }
}

// Utility functions
function showScreen(screenId) {
    console.log(`Switching to screen: ${screenId}`);
    
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        console.log(`Screen ${screenId} is now active`);
    } else {
        console.error(`Screen ${screenId} not found!`);
    }
}

function showSnackbar(message, type = 'success') {
    let snackbar = document.getElementById('snackbar');
    if (!snackbar) {
        snackbar = document.createElement('div');
        snackbar.id = 'snackbar';
        snackbar.className = 'snackbar hidden';
        document.body.appendChild(snackbar);
    }
    
    snackbar.textContent = message;
    snackbar.className = `snackbar ${type}`;
    snackbar.classList.remove('hidden');
    
    setTimeout(() => {
        snackbar.classList.add('hidden');
    }, 3000);
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.parentNode.querySelector('.toggle-password i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function toggleDropdown() {
    const dropdown = document.getElementById('user-dropdown');
    const dropdownBtn = document.querySelector('.dropdown-btn');
    
    dropdown.classList.toggle('hidden');
    dropdownBtn.classList.toggle('active');
}

// Admin functions
async function loadAdminDashboard() {
    if (!currentUser || currentUser.role !== 'admin') return;
    
    const adminContainer = document.querySelector('.admin-container');
    adminContainer.innerHTML = `
        <div class="screen-header">
            <h2>Admin Dashboard</h2>
            <div class="admin-header-actions">
                <button class="btn btn-danger" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i>
                    Logout
                </button>
            </div>
        </div>
        
        <div class="admin-stats" id="admin-stats">
            <!-- Stats will be loaded here -->
        </div>
        
        <div class="card">
            <h3>System Overview</h3>
            <div id="admin-overview">
                <!-- Overview will be loaded here -->
            </div>
        </div>
    `;
    
    await loadAdminStats();
}

async function loadAdminStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            const statsContainer = document.getElementById('admin-stats');
            
            statsContainer.innerHTML = `
                <div class="admin-stat-card">
                    <div class="admin-stat-value">${stats.total_medicines}</div>
                    <div class="admin-stat-label">Total Medicines</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-value">${stats.active_medicines}</div>
                    <div class="admin-stat-label">Active Medicines</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-value">${stats.total_users}</div>
                    <div class="admin-stat-label">Total Users</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-value">${stats.today_taken}</div>
                    <div class="admin-stat-label">Today Taken</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-value">${stats.today_missed}</div>
                    <div class="admin-stat-label">Today Missed</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load admin stats:', error);
    }
}

