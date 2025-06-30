# Card Creator Desktop Application

This is the desktop version of the Card Creator application built with Electron.

## Development

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation
```bash
npm install
```

### Running in Development
```bash
npm run dev
```

### Building the Application
```bash
# Build for Windows
npm run build-installer
```

The built installer will be available in the `dist` folder.

## Features
- Card creation and management
- WebDAV file explorer
- Image thumbnail generation
- Desktop shortcuts creation
- Professional installer

## Build Configuration
The application is configured to:
- Create desktop shortcuts
- Create start menu shortcuts
- Allow custom installation directory
- Generate Windows installer (.exe)

## File Structure
```
electron-app/
├── main.js              # Main Electron process
├── preload.js           # Preload script for security
├── package.json         # Dependencies and build config
├── renderer/            # Web application files
│   ├── *.html          # HTML pages
│   ├── *.js            # JavaScript files
│   ├── *.css           # Stylesheets
│   ├── cards/          # Saved cards
│   ├── images/         # Image assets
│   └── data/           # Configuration data
└── assets/             # Application assets
    └── icon.ico        # Application icon
``` 