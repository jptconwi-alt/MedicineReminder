
let currentUser = null;
let notificationSound = null;
let reminderInterval = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('Medicine Reminder App Initialized');
    
    // Set current date for start date field
    const startDateField = document.getElementById('start-date');
    if (startDateField) {
        startDateField.valueAsDate = new Date();
    }
    // Add to the end of DOMContentLoaded event listener
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => {
            console.log('Service Worker registered:', registration);
        })
        .catch(error => {
            console.log('Service Worker registration failed:', error);
        });
}
    
    // Initialize notification sound
    initializeNotificationSound();
    
    // Check authentication status immediately
    checkAuthStatus();
    setupEventListeners();
    
    // Start reminder checking
    startReminderChecking();
});

// Initialize notification sound with ringtone
function initializeNotificationSound() {
    try {
        // Initialize the ringtone audio
        const ringtone = document.getElementById('hyunjin-ringtone');
        if (ringtone) {
            notificationSound = ringtone;
            console.log('🔊 Ringtone initialized:', notificationSound.src);
        } else {
            console.warn('🔇 Ringtone element not found');
            notificationSound = 'fallback';
        }
    } catch (error) {
        console.warn('🔇 Audio initialization failed, using fallback');
        notificationSound = 'fallback';
    }
}

// Play the hyunjin ringtone for alarms
function playAlarmSound() {
    if (!notificationSound || notificationSound === 'fallback') {
        playFallbackAlarmSound();
        return;
    }

    try {
        // Check if audio element exists and has valid source
        if (!notificationSound || !notificationSound.src || notificationSound.src.includes('undefined')) {
            console.warn('🔇 Invalid audio source, using fallback');
            playFallbackAlarmSound();
            return;
        }
        
        // Stop any currently playing ringtone
        if (!notificationSound.paused) {
            notificationSound.pause();
            notificationSound.currentTime = 0;
        }
        
        // Play the hyunjin ringtone
        notificationSound.loop = true;
        notificationSound.volume = 0.7;
        
        const playPromise = notificationSound.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn('Could not play ringtone:', error);
                playFallbackAlarmSound();
            });
        }
        
        console.log('🔔 Playing ringtone for alarm');
    } catch (error) {
        console.warn('Could not play ringtone:', error);
        playFallbackAlarmSound();
    }
}

// Fallback alarm sound (original function)
function playFallbackAlarmSound() {
    if (!notificationSound || notificationSound === 'fallback') {
        // More noticeable fallback sound - multiple beeps
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                console.log('\x07'); // ASCII bell
                // Also try HTML5 audio fallback
                try {
                    const audio = new Audio("data:audio/wav;base64,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qJrx4KOQakahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=");
                    audio.volume = 0.3;
                    audio.play().catch(e => console.log('Audio play failed:', e));
                } catch (audioError) {
                    console.log('HTML5 audio failed');
                }
            }, i * 600);
        }
    } else {
        // More urgent and repeating Web Audio API alarm
        const playBeep = (startTime, frequency) => {
            const oscillator = notificationSound.createOscillator();
            const gainNode = notificationSound.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(notificationSound.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            // Sharp attack, quick decay
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + 0.3);
        };
        
        const currentTime = notificationSound.currentTime;
        
        // Play multiple beeps with different frequencies
        playBeep(currentTime, 1000);
        playBeep(currentTime + 0.4, 1200);
        playBeep(currentTime + 0.8, 1000);
        playBeep(currentTime + 1.2, 800);
    }
}

// Stop the ringtone when alarm is dismissed
function stopAlarmSound() {
    if (notificationSound && notificationSound !== 'fallback' && !notificationSound.paused) {
        try {
            notificationSound.pause();
            notificationSound.currentTime = 0;
            console.log('🔕 Ringtone stopped');
        } catch (error) {
            console.warn('Could not stop ringtone:', error);
        }
    }
}

// Start checking for reminders
function startReminderChecking() {
    // Check every 30 seconds for due reminders
    reminderInterval = setInterval(async () => {
        if (currentUser) {
            await checkDueReminders();
            updateMedicineCountdowns(); // Update countdowns every minute
        }
    }, 30000); // Check every 30 seconds
    
    // Also check immediately
    if (currentUser) {
        setTimeout(() => {
            checkDueReminders();
            updateMedicineCountdowns();
        }, 2000);
    }
    
    // Update countdowns every 30 seconds for better accuracy
    setInterval(() => {
        if (currentUser) {
            updateMedicineCountdowns();
        }
    }, 30000);
}

// Check for due reminders
async function checkDueReminders() {
    try {
        const response = await fetch('/api/user_notifications');
        const data = await response.json();
        
        if (data.success) {
            const unreadNotifications = data.notifications.filter(n => !n.is_read && n.type === 'reminder');
            
            // Check for new notifications to show as alarms
            for (const notification of unreadNotifications) {
                if (!sessionStorage.getItem(`alarm_shown_${notification.id}`)) {
                    showMedicineAlarm(notification);
                    sessionStorage.setItem(`alarm_shown_${notification.id}`, 'true');
                    
                    // Mark as read after showing
                    await markNotificationAsRead(notification.id);
                }
            }
            
            updateNotificationBadge(unreadNotifications.length);
        }
    } catch (error) {
        console.error('Error checking reminders:', error);
    }
}

// Enhanced alarm function
function showMedicineAlarm(notification) {
    console.log('🔔 Showing alarm for:', notification.message);
    
    // Play alarm sound
    playAlarmSound();
    
    // Show browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification('💊 Medicine Reminder', {
                body: notification.message,
                icon: '/static/icon-192.png',
                tag: 'medicine-alarm',
                requireInteraction: true
            });
        } catch (error) {
            console.warn('Browser notification failed:', error);
        }
    }
    
    // Show in-app alarm modal
    showAlarmModal(notification);
}

// Alarm modal function
function showAlarmModal(notification) {
    // Remove existing alarm modal if any
    const existingModal = document.getElementById('alarm-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'alarm-modal';
    modal.className = 'alarm-modal';
    modal.innerHTML = `
        <div class="alarm-content">
            <div class="alarm-header">
                <i class="fas fa-music alarm-icon"></i>
                <h3>💊 Medicine Reminder</h3>
            </div>
            <div class="alarm-message">
                <p>${notification.message}</p>
                <p class="alarm-time">${new Date().toLocaleTimeString()}</p>
            </div>
            <div class="ringtone-indicator">
                <i class="fas fa-volume-up"></i>
                <span>Playing hyunjin ringtone...</span>
                <div class="sound-wave">
                    <span></span><span></span><span></span><span></span><span></span>
                </div>
            </div>
            <div class="alarm-actions">
                <button class="btn btn-success" onclick="handleAlarmAction('taken', ${notification.id})">
                    <i class="fas fa-check"></i> Mark as Taken
                </button>
                <button class="btn btn-warning" onclick="handleAlarmAction('snooze', ${notification.id})">
                    <i class="fas fa-clock"></i> Snooze 10 min
                </button>
                <button class="btn btn-secondary" onclick="closeAlarmModal()">
                    <i class="fas fa-times"></i> Dismiss
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-close after 5 minutes
    setTimeout(() => {
        if (document.body.contains(modal)) {
            closeAlarmModal();
        }
    }, 5 * 60 * 1000);
}

function closeAlarmModal() {
    // Stop ringtone when closing modal
    stopAlarmSound();
    
    const modal = document.getElementById('alarm-modal');
    if (modal) {
        modal.remove();
    }
    
    // Clear session storage flags for shown alarms
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
        if (key.startsWith('alarm_shown_')) {
            sessionStorage.removeItem(key);
        }
    });
}

async function handleAlarmAction(action, notificationId) {
    // Stop the ringtone when any action is taken
    stopAlarmSound();
    
    if (action === 'taken') {
        // Extract medicine ID from notification
        const medicineId = await getMedicineIdFromNotification(notificationId);
        if (medicineId) {
            await logMedicineTaken(medicineId);
            showSnackbar('Medicine marked as taken!');
        }
    } else if (action === 'snooze') {
        // Snooze logic - reschedule alarm for 10 minutes later
        showSnackbar('Reminder snoozed for 10 minutes');
        setTimeout(() => {
            checkDueReminders();
        }, 10 * 60 * 1000);
    }
    
    closeAlarmModal();
}

async function getMedicineIdFromNotification(notificationId) {
    try {
        const response = await fetch('/api/user_notifications');
        const data = await response.json();
        if (data.success) {
            const notification = data.notifications.find(n => n.id === notificationId);
            return notification ? notification.medicine_id : null;
        }
    } catch (error) {
        console.error('Error getting medicine ID:', error);
    }
    return null;
}

// Update notification badge
function updateNotificationBadge(count) {
    const notificationBell = document.getElementById('notification-bell');
    if (!notificationBell) return;
    
    let badge = document.getElementById('notification-badge');
    
    if (count > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'notification-badge';
            badge.className = 'notification-badge';
            notificationBell.appendChild(badge);
        }
        badge.textContent = count > 9 ? '9+' : count.toString();
        badge.style.display = 'flex';
    } else if (badge) {
        badge.style.display = 'none';
    }
}

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
        medicineForm.addEventListener('submit', handleMedicineSubmit);
    }
    
    // Notification bell
    const notificationBell = document.getElementById('notification-bell');
    if (notificationBell) {
        notificationBell.addEventListener('click', showNotificationsScreen);
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
    const specificTimesInput = document.getElementById('specific-times').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const instructions = document.getElementById('instructions').value;
    const priority = document.getElementById('priority').value;
    
    console.log('📋 Form data:', { 
        medicineName, dosage, frequency, scheduleType, 
        timesPerDay, specificTimesInput, startDate, endDate, instructions, priority 
    });
    
    // Validate form
    if (!validateMedicineForm()) {
        return;
    }
    
    // Handle specific times - convert 12-hour to 24-hour for storage
    let specific_times = null;
    // Update the time validation section
if (specificTimesInput) {
    const timesArray = specificTimesInput.split(',').map(time => time.trim()).filter(time => time);
    specific_times = [];
    
    // Validate and convert each time
    for (let time of timesArray) {
        // Enhanced validation
        if (!isValidTimeFormat(time)) {
            showSnackbar(`Invalid time format: ${time}. Use formats like: 8:00 AM, 08:00 AM, 2:00 PM, 14:00`, 'error');
            return;
        }
        // Convert to 24-hour format for storage
        specific_times.push(convertTo24Hour(time));
    }
}

// Add new validation function
function isValidTimeFormat(time) {
    // Accepts: 8:00 AM, 08:00 AM, 2:00 PM, 14:00
    const timeRegex12 = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s*(AM|PM)$/i;
    const timeRegex24 = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    
    return timeRegex12.test(time) || timeRegex24.test(time);
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
                specific_times: specific_times,
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

// Add these utility functions for time conversion
function convertTo12Hour(time24) {
    if (!time24) return '';
    
    try {
        const [hours, minutes] = time24.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    } catch (error) {
        console.error('Error converting time:', error);
        return time24;
    }
}

function convertTo24Hour(time12) {
    if (!time12) return '';
    
    try {
        const [timePart, ampm] = time12.split(' ');
        let [hours, minutes] = timePart.split(':');
        
        hours = parseInt(hours);
        if (ampm === 'PM' && hours < 12) {
            hours += 12;
        } else if (ampm === 'AM' && hours === 12) {
            hours = 0;
        }
        
        return `${hours.toString().padStart(2, '0')}:${minutes}`;
    } catch (error) {
        console.error('Error converting time:', error);
        return time12;
    }
}

// Update the medicine form validation for 12-hour format
function isValidTimeFormat12H(time) {
    const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i;
    return timeRegex.test(time);
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
            
            // Request notification permission
            requestNotificationPermission();
            
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

// Request browser notification permission
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            console.log('Notification permission:', permission);
        });
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
            medicinesList.innerHTML = data.medicines.map(medicine => {
                let specificTimesDisplay = '';
                if (medicine.specific_times) {
                    try {
                        const times = JSON.parse(medicine.specific_times);
                        specificTimesDisplay = times.map(time => convertTo12Hour(time)).join(', ');
                    } catch (e) {
                        specificTimesDisplay = convertTo12Hour(medicine.specific_times);
                    }
                }
                
                return `
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
                    ${specificTimesDisplay ? `
                        <div class="medicine-times">
                            <i class="fas fa-clock"></i> Times: ${specificTimesDisplay}
                        </div>
                    ` : ''}
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
                        <button class="btn btn-danger" onclick="removeMedicine(${medicine.id})">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>
                `;
            }).join('');
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
        const upcomingRemindersList = document.getElementById('upcoming-reminders-list');
        
        const renderReminder = (reminder) => `
            <div class="reminder-card ${reminder.is_urgent ? 'urgent' : ''}">
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
        `;
        
        // Update dashboard reminders
        if (remindersList) {
            if (data.success && data.reminders.length > 0) {
                remindersList.innerHTML = data.reminders.slice(0, 3).map(renderReminder).join('');
            } else {
                remindersList.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #64748b;">
                        <p>No upcoming reminders</p>
                    </div>
                `;
            }
        }
        
        // Update upcoming reminders screen
        if (upcomingRemindersList) {
            if (data.success && data.reminders.length > 0) {
                upcomingRemindersList.innerHTML = data.reminders.map(renderReminder).join('');
            } else {
                upcomingRemindersList.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                        <i class="fas fa-bell" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                        <p>No upcoming reminders</p>
                    </div>
                `;
            }
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

async function markNotificationAsRead(notificationId) {
    try {
        const response = await fetch(`/api/mark_notification_read/${notificationId}`, {
            method: 'POST'
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
    }
}

function showNotificationsScreen() {
    // You can implement a notifications screen here
    showSnackbar('Notifications feature coming soon!', 'info');
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

// Add countdown display function
function updateMedicineCountdowns() {
    const medicineCards = document.querySelectorAll('.medicine-card');
    
    medicineCards.forEach(card => {
        const timesElement = card.querySelector('.medicine-times');
        if (timesElement) {
            const timesText = timesElement.textContent.replace('Times: ', '');
            const times = timesText.split(', ').map(time => time.trim());
            
            // Find next upcoming time
            const now = new Date();
            let nextTime = null;
            let minDiff = Infinity;
            
            times.forEach(time12 => {
                const time24 = convertTo24Hour(time12);
                const [hours, minutes] = time24.split(':');
                const targetTime = new Date();
                targetTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                
                // If time has passed today, set for tomorrow
                if (targetTime < now) {
                    targetTime.setDate(targetTime.getDate() + 1);
                }
                
                const diff = targetTime - now;
                if (diff < minDiff && diff > 0) {
                    minDiff = diff;
                    nextTime = targetTime;
                }
            });
            
            // Update or create countdown element
            let countdownElement = card.querySelector('.medicine-countdown');
            if (!countdownElement) {
                countdownElement = document.createElement('div');
                countdownElement.className = 'medicine-countdown';
                card.querySelector('.medicine-footer').before(countdownElement);
            }
            
            if (nextTime) {
                const hours = Math.floor(minDiff / (1000 * 60 * 60));
                const minutes = Math.floor((minDiff % (1000 * 60 * 60)) / (1000 * 60));
                
                if (hours > 0) {
                    countdownElement.innerHTML = `<i class="fas fa-hourglass-half"></i> Next dose in ${hours}h ${minutes}m`;
                } else {
                    countdownElement.innerHTML = `<i class="fas fa-hourglass-end"></i> Next dose in ${minutes}m`;
                }
                
                countdownElement.className = `medicine-countdown ${minutes < 30 ? 'countdown-urgent' : 'countdown-normal'}`;
            } else {
                countdownElement.innerHTML = `<i class="fas fa-check-circle"></i> All doses taken today`;
                countdownElement.className = 'medicine-countdown countdown-complete';
            }
        }
    });
}

// Remove medicine function
async function removeMedicine(medicineId) {
    if (!confirm('Are you sure you want to remove this medicine?')) {
        return;
    }

    try {
        const response = await fetch(`/api/remove_medicine/${medicineId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSnackbar('Medicine removed successfully!');
            await loadUserMedicines();
            await loadStats();
        } else {
            showSnackbar(data.message || 'Failed to remove medicine', 'error');
        }
    } catch (error) {
        console.error('Failed to remove medicine:', error);
        showSnackbar('Failed to remove medicine', 'error');
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

// Function to show upcoming reminders in menu
function showUpcomingRemindersMenu() {
    showScreen('upcoming-reminders-screen');
    loadUpcomingReminders();
}



