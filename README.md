# Rituo - Habit Building App

Rituo is a modern web application designed to help users build and maintain daily habits through a 30-day commitment system. The app provides a clean, intuitive interface with powerful analytics to track progress and maintain motivation.

## Features

- 30-day commitment system for habit formation
- Daily task tracking and progress visualization
- Beautiful analytics and statistics
- Dark mode support
- Responsive design for all devices
- Smooth animations and transitions

## Tech Stack

- Frontend: React.js with Tailwind CSS
- Backend: Node.js with Express
- Database: MongoDB
- Authentication: JWT

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/rituo.git
cd rituo
```

2. Install dependencies:
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

3. Set up environment variables:
   - Create a `.env` file in the server directory
   - Add the following variables:
     ```
     PORT=5000
     MONGODB_URI=your_mongodb_uri
     JWT_SECRET=your_jwt_secret
     ```

4. Start the development servers:
```bash
# Start the backend server (from server directory)
npm run dev

# Start the frontend development server (from client directory)
npm run dev
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.