/**
 * Service for interacting with Google Calendar API
 */

import { authService } from './auth.js';

const CALENDAR_ERROR_MESSAGES = {
  FETCH_FAILED: 'Failed to fetch calendar events',
  CREATE_FAILED: 'Failed to create calendar event',
  DELETE_FAILED: 'Failed to delete calendar event',
};

class CalendarService {
  constructor() {
    this.baseUrl = 'https://www.googleapis.com/calendar/v3';
  }

  /**
   * Fetch user's calendar list
   * @returns {Promise<Array>} Array of calendar objects
   */
  async fetchCalendarList() {
    try {
      const response = await authService.makeAuthenticatedRequest(
        `${this.baseUrl}/users/me/calendarList`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Failed to fetch calendar list:', error);
      throw new Error('Failed to fetch calendars');
    }
  }

  /**
   * Fetch events from a calendar
   * @param {string} calendarId - The calendar ID
   * @param {Date} timeMin - Start of time range
   * @param {Date} timeMax - End of time range
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} Array of calendar events
   */
  async fetchEvents(calendarId, timeMin, timeMax, options = {}) {
    if (!calendarId) {
      throw new Error('Calendar ID is required');
    }

    if (!(timeMin instanceof Date) || !(timeMax instanceof Date)) {
      throw new Error('timeMin and timeMax must be Date objects');
    }

    console.log('Fetching events with params:', {
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      options
    });

    // Filter out null/undefined values from options
    const cleanOptions = Object.fromEntries(
      Object.entries(options).filter(([_, value]) => value != null)
    );

    // Construct query parameters
    const params = {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: options.maxResults || '2500',
      ...cleanOptions
    };

    const queryParams = new URLSearchParams(params).toString();

    try {
      // Properly encode the calendar ID and construct the URL
      const encodedCalendarId = encodeURIComponent(calendarId);
      const url = `${this.baseUrl}/calendars/${encodedCalendarId}/events?${queryParams}`;
      console.log('Fetching events from URL:', url);

      const response = await authService.makeAuthenticatedRequest(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Calendar API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`HTTP ${response.status}: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log(`Successfully fetched ${data.items?.length || 0} events`);
      return data.items || [];
    } catch (error) {
      console.error('Failed to fetch events:', error);
      throw new Error(`${CALENDAR_ERROR_MESSAGES.FETCH_FAILED}: ${error.message}`);
    }
  }

  /**
   * Create a busy event in a calendar
   * @param {string} calendarId - The calendar ID
   * @param {Object} sourceEvent - The source event to base the busy event on
   * @returns {Promise<Object>} The created event
   */
  async createBusyEvent(calendarId, sourceEvent) {
    if (!sourceEvent.start?.dateTime || !sourceEvent.end?.dateTime) {
      return null; // Skip events without specific times
    }

    const startTime = new Date(sourceEvent.start.dateTime);
    const endTime = new Date(sourceEvent.end.dateTime);

    // Skip multi-day events
    if (startTime.getDate() !== endTime.getDate()) {
      return null;
    }

    const busyEvent = {
      summary: 'Busy',
      start: {
        dateTime: sourceEvent.start.dateTime,
        timeZone: sourceEvent.start.timeZone
      },
      end: {
        dateTime: sourceEvent.end.dateTime,
        timeZone: sourceEvent.end.timeZone
      },
      transparency: 'opaque',
      visibility: 'private',
      description: 'Automatically synced busy time',
      extendedProperties: {
        private: {
          syncedEvent: 'true',
          syncTime: new Date().toISOString()
        }
      }
    };

    try {
      const response = await authService.makeAuthenticatedRequest(
        `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(busyEvent)
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to create busy event:', error);
      throw new Error(CALENDAR_ERROR_MESSAGES.CREATE_FAILED);
    }
  }

  /**
   * Delete an event from a calendar
   * @param {string} calendarId - The calendar ID
   * @param {string} eventId - The event ID
   * @returns {Promise<void>}
   */
  async deleteEvent(calendarId, eventId) {
    try {
      const response = await authService.makeAuthenticatedRequest(
        `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to delete event ${eventId}:`, error);
      throw new Error(CALENDAR_ERROR_MESSAGES.DELETE_FAILED);
    }
  }

  /**
   * Find and delete all synced events in a time range
   * @param {string} calendarId - The calendar ID
   * @param {Date} startTime - Start of time range
   * @param {Date} endTime - End of time range
   * @returns {Promise<number>} Number of events deleted
   */
  async cleanupSyncedEvents(calendarId, startTime, endTime) {
    let allEvents = [];
    let pageToken = null;

    do {
      const events = await this.fetchEvents(calendarId, startTime, endTime, {
        pageToken
      });

      const data = await events;
      allEvents = allEvents.concat(data);
      pageToken = data.nextPageToken;
    } while (pageToken);

    // Filter for synced events
    const syncedEvents = allEvents.filter(event => 
      event.extendedProperties?.private?.syncedEvent === 'true'
    );

    console.log(`Found ${syncedEvents.length} synced events to delete`);

    // Delete all synced events
    for (const event of syncedEvents) {
      await this.deleteEvent(calendarId, event.id);
    }

    return syncedEvents.length;
  }
}

// Export a singleton instance
export const calendarService = new CalendarService(); 