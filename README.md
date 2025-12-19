# Our Soundtrack 💕

A modern, web-based personal music player created as a **romantic gift for my girlfriend**. This project delivers a custom playlist of songs that are meaningful to our relationship (+ 3 covers sung by me), wrapped in a beautiful interface featuring glassmorphism, background videos, and a responsive design.

> _Every note is a piece of us._

## Features

- **Audio Player**: Full control over playback with Play/Pause, Next, Previous, Shuffle, and Repeat functionalities.
- **Dynamic Playlist**: Sidebar playlist that automatically indexes tracks.
- **Visual Experience**:
  - **Glassmorphism UI**: Modern, semi-transparent design elements.
  - **Background Videos**: Supports dynamic video backgrounds for specific tracks.
  - **Album Art**: Displays cover art for the currently playing track.
- **Responsive Design**: Works seamlessly on desktop and mobile devices, with a collapsible sidebar on smaller screens.
- **PWA Support**: Includes a Service Worker (`service-worker.js`) and Manifest for Progressive Web App capabilities (installable on devices).

## Project Structure

- `index.html`: Main structure of the application.
- `style.css`: All styling, including animations and responsive rules.
- `script.js`: Core logic for the player, playlist generation, and resource preloading.
- `music/`: Directory for MP3 files (format: `Artist - Title.mp3`).
- `images/`: Directory for album covers (matches MP3 filename).
- `videos/`: Directory for background videos (matches MP3 filename).

## Setup & Usage

1.  **Add Music**: Place your `.mp3` files in the `music/` folder.
    - Naming convention: `Artist - Title.mp3` or just `Title.mp3`.
2.  **Add Covers**: Place `.jpg` or `.png` images in `images/` with the same filename as the audio file.
3.  **Add Videos**: (Optional) Place `.mp4` files in `videos/` with the same filename as the audio file.
4.  **Run**: Open `index.html` in a modern web browser.
    - _Note: For PWA features and proper module loading, it is recommended to serve the files via a local web server (e.g., Live Server in VS Code)._

## Technologies

- HTML5
- CSS3 (Variables, Flexbox, Grid, Backdrop Filter)
- JavaScript (ES6+)

## Customization

You can customize the look and feel by editing the CSS variables in `style.css` (root section) or changing the fonts in `index.html`.
