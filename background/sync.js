/**
 * Service for handling calendar sync operations
 */

import { calendarService } from './calendar.js';
import { storageService } from '../utils/storage.js';

const SYNC_ERROR_MESSAGES = {
  NOT_CONFIGURED: 'Extension not configured',
  SYNC_FAILED: 'Calendar sync failed',
  CLEANUP_FAILED: 'Cleanup operation failed',
};

class SyncService {
  constructor() {
    this._syncInProgress = false;
    this._lastSyncTime = null;
  }

  /**
   * Calculate the date range for sync operations
   * @param {number} weeksAhead - Number of weeks to look ahead
   * @returns {Object} Object containing start and end dates
   */
  _getDateRange(weeksAhead) {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (weeksAhead * 7));
    endDate.setHours(23, 59, 59, 999);

    const cleanupStart = new Date(startDate);
    cleanupStart.setDate(startDate.getDate() - 7); // One week ago

    return { cleanupStart, startDate, endDate };
  }

  /**
   * Initialize the sync alarm
   * @param {number} intervalMinutes - Sync interval in minutes
   */
  initializeSyncAlarm(intervalMinutes) {
    chrome.alarms.create('calendarSync', {
      periodInMinutes: parseInt(intervalMinutes)
    });
  }

  /**
   * Perform the calendar sync operation
   * @returns {Promise<void>}
   */
  async performSync() {
    if (this._syncInProgress) {
      console.log('Sync already in progress');
      return;
    }

    try {
      this._syncInProgress = true;
      const settings = await storageService.getSettings();
      
      if (!settings?.targetCalendar || !settings?.sourceCalendars?.length) {
        throw new Error('Sync settings not configured');
      }

      const targetCalendar = settings.targetCalendar.trim();
      const sourceCalendars = settings.sourceCalendars.map(id => id.trim());

      console.log('Starting sync with settings:', {
        target: targetCalendar,
        sources: sourceCalendars,
        weeksAhead: settings.weeksAhead
      });

      // Calculate time range
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - 7); // One week ago
      const endTime = new Date();
      endTime.setDate(endTime.getDate() + (settings.weeksAhead * 7));

      // First, get all existing synced events in the target calendar
      const existingSyncedEvents = await calendarService.fetchEvents(targetCalendar, startTime, endTime);
      const existingSyncedMap = new Map(
        existingSyncedEvents
          .filter(event => event.extendedProperties?.private?.syncedEvent === 'true')
          .map(event => [
            this._createEventKey(event),
            event
          ])
      );

      console.log(`Found ${existingSyncedMap.size} existing synced events`);

      // Track which events we want to keep
      const eventsToKeep = new Set();

      // Fetch and sync events from each source calendar
      for (const sourceCalendar of sourceCalendars) {
        console.log(`Processing source calendar: ${sourceCalendar}`);
        const events = await calendarService.fetchEvents(sourceCalendar, startTime, endTime);
        console.log(`Found ${events.length} events in source calendar ${sourceCalendar}`);

        for (const event of events) {
          // Skip events without specific times or multi-day events
          if (!event.start?.dateTime || !event.end?.dateTime) {
            continue;
          }

          const startTime = new Date(event.start.dateTime);
          const endTime = new Date(event.end.dateTime);
          if (startTime.getDate() !== endTime.getDate()) {
            continue;
          }

          const eventKey = this._createEventKey({
            start: { dateTime: event.start.dateTime },
            end: { dateTime: event.end.dateTime }
          });

          // If we don't have this event synced yet, create it
          if (!existingSyncedMap.has(eventKey)) {
            await calendarService.createBusyEvent(targetCalendar, event);
          }

          // Mark this time slot as needed
          eventsToKeep.add(eventKey);
        }
      }

      // Delete any synced events that are no longer needed
      for (const [eventKey, event] of existingSyncedMap) {
        if (!eventsToKeep.has(eventKey)) {
          console.log(`Deleting obsolete synced event: ${event.id}`);
          await calendarService.deleteEvent(targetCalendar, event.id);
        }
      }

      this._lastSyncTime = new Date();
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      this._syncInProgress = false;
    }
  }

  /**
   * Create a unique key for an event based on its time
   * @private
   * @param {Object} event - The event object
   * @returns {string} A unique key for the event
   */
  _createEventKey(event) {
    return `${event.start.dateTime}_${event.end.dateTime}`;
  }

  /**
   * Clean up all synced events
   * @returns {Promise<void>}
   */
  async cleanupAll() {
    try {
      const settings = await storageService.getSettings();
      if (!settings?.targetCalendar) {
        throw new Error(SYNC_ERROR_MESSAGES.NOT_CONFIGURED);
      }

      const { cleanupStart, endDate } = this._getDateRange(settings.weeksAhead || 1);
      await calendarService.cleanupSyncedEvents(
        settings.targetCalendar,
        cleanupStart,
        endDate
      );
    } catch (error) {
      console.error('Cleanup failed:', error);
      throw new Error(SYNC_ERROR_MESSAGES.CLEANUP_FAILED);
    }
  }

  /**
   * Get the last sync time
   * @returns {Date|null} The last sync time or null if never synced
   */
  getLastSyncTime() {
    return this._lastSyncTime;
  }

  /**
   * Check if a sync is currently in progress
   * @returns {boolean} True if sync is in progress
   */
  isSyncing() {
    return this._syncInProgress;
  }
}

// Export a singleton instance
export const syncService = new SyncService(); 