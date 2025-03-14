/**
 * Service for handling Chrome storage operations
 */

const STORAGE_KEYS = {
  SETTINGS: 'calendar_sync_settings'
};

class StorageService {
  /**
   * Save settings to Chrome storage
   * @param {Object} settings - The settings to save
   * @returns {Promise<void>}
   */
  async saveSettings(settings) {
    try {
      console.log('Saving settings:', settings);
      await chrome.storage.sync.set({
        [STORAGE_KEYS.SETTINGS]: settings
      });
      console.log('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw new Error('Failed to save settings');
    }
  }

  /**
   * Get settings from Chrome storage
   * @returns {Promise<Object>} The stored settings
   */
  async getSettings() {
    try {
      const data = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
      const settings = data[STORAGE_KEYS.SETTINGS];
      console.log('Retrieved settings:', settings);
      return settings || {
        targetCalendar: '',
        sourceCalendars: [],
        syncInterval: 60,
        weeksAhead: 4
      };
    } catch (error) {
      console.error('Failed to get settings:', error);
      throw new Error('Failed to get settings');
    }
  }

  /**
   * Clear all stored settings
   * @returns {Promise<void>}
   */
  async clearSettings() {
    try {
      await chrome.storage.sync.remove(STORAGE_KEYS.SETTINGS);
      console.log('Settings cleared successfully');
    } catch (error) {
      console.error('Failed to clear settings:', error);
      throw new Error('Failed to clear settings');
    }
  }
}

// Export a singleton instance
export const storageService = new StorageService(); 