/**
 * Popup UI controller
 */

import { storageService } from '../utils/storage.js';

class PopupController {
  constructor() {
    this.elements = {
      settingsForm: document.getElementById('settingsForm'),
      targetCalendar: document.getElementById('targetCalendar'),
      sourceCalendarList: document.getElementById('sourceCalendarList'),
      syncInterval: document.getElementById('syncInterval'),
      weeksAhead: document.getElementById('weeksAhead'),
      syncNow: document.getElementById('syncNow'),
      cleanupAll: document.getElementById('cleanupAll'),
      syncStatus: document.getElementById('syncStatus'),
      lastSyncTime: document.getElementById('lastSyncTime'),
      statusMessage: document.getElementById('statusMessage')
    };

    this.calendars = [];
    this.initialize();
  }

  /**
   * Initialize the popup
   */
  async initialize() {
    this.bindEventListeners();
    try {
      // First load calendars
      await this.loadCalendars();
      // Then load settings after calendars are available
      await this.loadSettings();
      await this.updateStatus();
      this.startStatusPolling();
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.showMessage('Failed to initialize: ' + error.message, 'error');
    }
  }

  /**
   * Bind event listeners to UI elements
   */
  bindEventListeners() {
    this.elements.settingsForm.addEventListener('submit', (e) => this.handleSettingsSave(e));
    this.elements.syncNow.addEventListener('click', () => this.handleSync());
    this.elements.cleanupAll.addEventListener('click', () => this.handleCleanup());
  }

  /**
   * Load available calendars from the API
   */
  async loadCalendars() {
    try {
      console.log('Requesting calendars from background...');
      const response = await chrome.runtime.sendMessage({ action: 'getCalendars' });
      console.log('Received calendar response:', response);
      
      if (!response.success) {
        throw new Error(response.error);
      }

      this.calendars = response.calendars;
      console.log('Available calendars:', this.calendars);
      this.updateCalendarUI();
    } catch (error) {
      console.error('Failed to load calendars:', error);
      this.showMessage('Failed to load calendars: ' + error.message, 'error');
    }
  }

  /**
   * Update the calendar UI elements
   */
  updateCalendarUI() {
    console.log('Updating calendar UI with calendars:', this.calendars);
    
    // Update target calendar dropdown
    this.elements.targetCalendar.innerHTML = `
      <option value="">Select a calendar</option>
      ${this.calendars.map(cal => `
        <option value="${cal.id}">${cal.summary}</option>
      `).join('')}
    `;

    // Update source calendar checkboxes
    this.elements.sourceCalendarList.innerHTML = this.calendars.map(cal => `
      <div class="calendar-checkbox">
        <input type="checkbox" 
               id="source-${cal.id}" 
               value="${cal.id}" 
               class="source-calendar">
        <div class="calendar-details">
          <label for="source-${cal.id}" class="calendar-name">${cal.summary}</label>
        </div>
      </div>
    `).join('');
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const settings = await storageService.getSettings();
      console.log('Loaded settings:', settings);
      
      if (settings && this.calendars.length > 0) {
        // Set target calendar
        if (settings.targetCalendar) {
          this.elements.targetCalendar.value = settings.targetCalendar;
          console.log('Set target calendar to:', settings.targetCalendar);
        }
        
        // Check source calendars
        if (settings.sourceCalendars && Array.isArray(settings.sourceCalendars)) {
          settings.sourceCalendars.forEach(calendarId => {
            const checkbox = document.getElementById(`source-${calendarId}`);
            if (checkbox) {
              checkbox.checked = true;
              console.log('Checked source calendar:', calendarId);
            } else {
              console.warn('Could not find checkbox for calendar:', calendarId);
            }
          });
        }

        // Set other settings
        if (settings.syncInterval) {
          this.elements.syncInterval.value = settings.syncInterval;
        }
        if (settings.weeksAhead) {
          this.elements.weeksAhead.value = settings.weeksAhead;
        }
      } else {
        // Set defaults if no settings found
        this.elements.syncInterval.value = 60;
        this.elements.weeksAhead.value = 4;
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Set defaults on error
      this.elements.syncInterval.value = 60;
      this.elements.weeksAhead.value = 4;
    }
  }

  /**
   * Handle settings form submission
   * @param {Event} event - The form submission event
   */
  async handleSettingsSave(event) {
    event.preventDefault();
    
    const targetCalendar = this.elements.targetCalendar.value;
    const sourceCalendars = Array.from(
      this.elements.sourceCalendarList.querySelectorAll('.source-calendar:checked')
    ).map(input => input.value);

    console.log('Selected target calendar:', targetCalendar);
    console.log('Selected source calendars:', sourceCalendars);

    if (!targetCalendar) {
      this.showMessage('Please select a target calendar', 'error');
      return;
    }

    if (sourceCalendars.length === 0) {
      this.showMessage('Please select at least one source calendar', 'error');
      return;
    }

    // Ensure targetCalendar is a string
    const settings = {
      targetCalendar: targetCalendar.toString(),
      sourceCalendars,
      syncInterval: parseInt(this.elements.syncInterval.value),
      weeksAhead: parseInt(this.elements.weeksAhead.value)
    };

    console.log('Saving settings:', settings);

    try {
      await storageService.saveSettings(settings);
      await chrome.runtime.sendMessage({ action: 'updateAlarm', interval: settings.syncInterval });
      this.showMessage('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showMessage('Failed to save settings: ' + error.message, 'error');
    }
  }

  /**
   * Handle sync button click
   */
  async handleSync() {
    try {
      this.elements.syncNow.disabled = true;
      console.log('Starting sync...');
      const response = await chrome.runtime.sendMessage({ action: 'syncNow' });
      console.log('Sync response:', response);
      
      if (response.success) {
        this.showMessage('Sync completed successfully', 'success');
        await this.updateStatus();
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Sync failed:', error);
      this.showMessage('Sync failed: ' + error.message, 'error');
    } finally {
      this.elements.syncNow.disabled = false;
    }
  }

  /**
   * Handle cleanup button click
   */
  async handleCleanup() {
    if (!confirm('Are you sure you want to clean up all synced events?')) {
      return;
    }

    try {
      this.elements.cleanupAll.disabled = true;
      const response = await chrome.runtime.sendMessage({ action: 'cleanupAll' });
      
      if (response.success) {
        this.showMessage('Cleanup completed successfully', 'success');
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      this.showMessage('Cleanup failed: ' + error.message, 'error');
    } finally {
      this.elements.cleanupAll.disabled = false;
    }
  }

  /**
   * Update the sync status display
   */
  async updateStatus() {
    try {
      const status = await chrome.runtime.sendMessage({ action: 'getStatus' });
      
      this.elements.syncStatus.textContent = status.isSyncing ? 'Syncing' : 'Idle';
      this.elements.syncStatus.classList.toggle('syncing', status.isSyncing);
      
      this.elements.lastSyncTime.textContent = status.lastSync 
        ? new Date(status.lastSync).toLocaleString()
        : 'Never';
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }

  /**
   * Start polling for status updates
   */
  startStatusPolling() {
    setInterval(() => this.updateStatus(), 1000);
  }

  /**
   * Show a status message
   * @param {string} message - The message to show
   * @param {string} type - The message type ('error' or 'success')
   */
  showMessage(message, type) {
    this.elements.statusMessage.textContent = message;
    this.elements.statusMessage.className = `status-message ${type}`;
    
    setTimeout(() => {
      this.elements.statusMessage.classList.add('hidden');
    }, 3000);
  }
}

// Initialize the popup when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
}); 