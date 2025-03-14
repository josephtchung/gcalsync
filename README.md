# Calendar Sync Chrome Extension

A Chrome extension that syncs busy times between Google Calendars. It creates "Busy" events in a target calendar based on events from source calendars.

Vibe-coded with Cursor and Claude

## Features

- Select target and source calendars from your Google Calendar account
- Automatically syncs busy times on a configurable interval
- Maintains privacy by only creating "Busy" events
- Configurable sync window (weeks ahead)
- Manual sync and cleanup options
- Efficient syncing that only updates changed events

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Configuration

1. Click the extension icon in Chrome
2. Select your target calendar (where busy events will be created)
3. Select one or more source calendars
4. Set your desired sync interval and weeks to sync ahead
5. Click "Save Settings"

## Development

The extension is built using vanilla JavaScript with ES modules. The code is organized as follows:

```
/gcalsync
├── background/     # Service worker and core services
│   ├── auth.js     # Authentication service
│   ├── calendar.js # Calendar API service
│   ├── index.js    # Main service worker
│   └── sync.js     # Sync coordination service
├── popup/          # UI components
│   ├── popup.html  # Popup interface
│   ├── popup.css   # Styles
│   └── popup.js    # Popup logic
├── utils/          # Shared utilities
│   └── storage.js  # Chrome storage service
└── manifest.json   # Extension manifest
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. # gcalsync
