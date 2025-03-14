/**
 * Authentication service for handling Google OAuth tokens
 */

const AUTH_ERROR_MESSAGES = {
  NOT_CONFIGURED: 'Extension not properly configured for authentication',
  TOKEN_FAILED: 'Failed to obtain authentication token',
  REFRESH_FAILED: 'Failed to refresh authentication token',
  USER_REJECTED: 'User declined to authenticate',
};

class AuthenticationService {
  constructor() {
    // Bind methods to this instance
    this.getToken = this.getToken.bind(this);
    this.refreshToken = this.refreshToken.bind(this);
    this.removeToken = this.removeToken.bind(this);
    
    // Initialize state
    this._tokenPromise = null;
  }

  /**
   * Get an authentication token, either from cache or by requesting a new one
   * @param {boolean} interactive - Whether to show UI if necessary
   * @returns {Promise<string>} The authentication token
   */
  async getToken(interactive = false) {
    // If we're already getting a token, return that promise
    if (this._tokenPromise) {
      return this._tokenPromise;
    }

    // Create a new promise for token acquisition
    this._tokenPromise = new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('Auth error:', chrome.runtime.lastError);
          reject(new Error(
            chrome.runtime.lastError.message === 'OAuth2 not granted or revoked.'
              ? AUTH_ERROR_MESSAGES.USER_REJECTED
              : AUTH_ERROR_MESSAGES.TOKEN_FAILED
          ));
        } else {
          console.log('Token acquired successfully');
          resolve(token);
        }
      });
    }).finally(() => {
      // Clear the promise so future calls will try again
      this._tokenPromise = null;
    });

    return this._tokenPromise;
  }

  /**
   * Refresh the authentication token
   * @param {string} token - The token to refresh
   * @returns {Promise<string>} A new authentication token
   */
  async refreshToken(token) {
    console.log('Refreshing auth token...');
    
    try {
      await this.removeToken(token);
      return await this.getToken(true); // Use interactive mode for refresh
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw new Error(AUTH_ERROR_MESSAGES.REFRESH_FAILED);
    }
  }

  /**
   * Remove a token from Chrome's cache
   * @param {string} token - The token to remove
   * @returns {Promise<void>}
   */
  async removeToken(token) {
    return new Promise((resolve) => {
      chrome.identity.removeCachedAuthToken({ token }, resolve);
    });
  }

  /**
   * Make an authenticated request to an API
   * @param {string} url - The URL to request
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} The fetch response
   */
  async makeAuthenticatedRequest(url, options = {}) {
    try {
      const token = await this.getToken(false);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`
        }
      });

      // Handle 401 by refreshing token and retrying once
      if (response.status === 401) {
        console.log('Token expired, refreshing...');
        const newToken = await this.refreshToken(token);
        
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`
          }
        });
      }

      return response;
    } catch (error) {
      console.error('Authentication request failed:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const authService = new AuthenticationService(); 