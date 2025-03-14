/**
 * Main background script for the extension
 */

import { authService } from './auth.js';
import { syncService } from './sync.js';
import { storageService } from '../utils/storage.js';
import { calendarService } from './calendar.js';

// Initialize extension when installed or updated
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed/updated');
  try {
    const settings = await storageService.getSettings();
    if (settings?.syncInterval) {
      syncService.initializeSyncAlarm(settings.syncInterval);
    }
  } catch (error) {
    console.log('Extension not yet configured');
  }
});

// Initialize extension when browser starts
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension starting up');
  try {
    // Try to get a token non-interactively to prime the auth cache
    await authService.getToken(false);
  } catch (error) {
    console.log('No cached auth token available');
  }
});

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'calendarSync') {
    syncService.performSync().catch(error => {
      console.error('Scheduled sync failed:', error);
    });
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.action);

  const handleMessage = async () => {
    try {
      switch (request.action) {
        case 'getCalendars':
          const calendars = await calendarService.fetchCalendarList();
          return { 
            success: true,
            calendars
          };

        case 'updateAlarm':
          syncService.initializeSyncAlarm(request.interval);
          return { success: true };

        case 'syncNow':
          await syncService.performSync();
          return { 
            success: true,
            lastSync: syncService.getLastSyncTime()
          };

        case 'cleanupAll':
          await syncService.cleanupAll();
          return { success: true };

        case 'getStatus':
          return {
            success: true,
            isSyncing: syncService.isSyncing(),
            lastSync: syncService.getLastSyncTime()
          };

        default:
          throw new Error(`Unknown action: ${request.action}`);
      }
    } catch (error) {
      console.error('Message handling failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };

  // Handle the async response
  handleMessage().then(sendResponse);
  return true; // Will respond asynchronously
}); 