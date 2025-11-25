// Global variables
let currentUser = null;
let authCheckTimeout;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting auth check...');
    
    authCheckTimeout = setTimeout(() => {
        console.log('Auth check timeout reached, forcing login screen');
        hideLoading();
        showScreen('login-screen');
    }, 5000);
    
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

// Authentication functions (same as community care)
async function checkAuthStatus() {
    try {
        console.log('Checking auth status...');
        const response = await fetch('/api/user_info');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Auth response:', data);
        
        clearTimeout(authCheckTimeout);
        
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
        clearTimeout(authCheckTimeout);
        showScreen('login-screen');
    } finally {
        hideLoading();
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

// Utility functions (same as community care)
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

function hideLoading() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.remove('active');
        console.log('Loading screen hidden');
    }
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// Admin functions (similar structure to community care)
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
