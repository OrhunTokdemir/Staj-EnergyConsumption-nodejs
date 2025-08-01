# Energy Consumption Data Collector

A Node.js application that automatically collects energy consumption data from the EPIAS (Energy Markets Operation Company) API and stores it in an Oracle database. The application includes scheduled data collection, email notifications, and comprehensive logging.

## Features

- 🔄 **Automated Data Collection**: Scheduled data fetching from EPIAS API
- 🗄️ **Oracle Database Integration**: Stores energy consumption data with duplicate prevention
- 📧 **Email Notifications**: Sends alerts for errors and system status
- 📊 **Comprehensive Logging**: Detailed logging system with timestamp-based log files
- 🐳 **Docker Support**: Full containerization with Docker Compose
- 🔒 **Error Handling**: Robust error handling with automatic data rollback on failures
- ⏰ **Scheduled Tasks**: Automated monthly data collection using node-schedule

## Architecture

The application consists of several key components:

- **Main Application** (`index.js`): Core application logic and API integration
- **Oracle Database Module** (`Oracledb.js`, `OracledbMethods.js`): Database connection and operations
- **Email Service** (`message.js`): Email notification system using Nodemailer
- **Logging System** (`logger.js`): Custom logging with file rotation
- **Time Utilities** (`time.js`): Date/time handling for period calculations

## Prerequisites

- Node.js 22.16.0 or higher
- Oracle Database (or Oracle XE via Docker)
- EPIAS API credentials
- Gmail account for email notifications (or SMTP server)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

### EPIAS API Credentials
```env
USERNAME1=your_first_epias_username
USERNAME2=your_second_epias_username
USERPASSWORD=your_epias_password
```

### Database Configuration
```env
DATABASE_USER=your_oracle_username
DATABASEPASSWORD=your_oracle_password
DATABASE_HOST=localhost
DATABASE_PORT=1521
```

### Email Configuration
```env
EMAIL_USER=your_gmail_address@gmail.com
EMAIL_PASS=your_app_password
EMAIL_RECIPIENT=recipient@example.com
```

### Environment
```env
NODE_ENV=production
```

## Installation

### Option 1: Local Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/OrhunTokdemir/Staj-EnergyConsumption-nodejs.git
   cd Staj-EnergyConsumption-nodejs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env` (if available) or create a new `.env` file
   - Fill in all required environment variables

4. **Run the application**
   ```bash
   npm start
   ```

### Option 2: Docker Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/OrhunTokdemir/Staj-EnergyConsumption-nodejs.git
   cd Staj-EnergyConsumption-nodejs
   ```

2. **Set up environment variables**
   - Create a `.env` file with all required variables
   - The Docker Compose file will automatically use these variables

3. **Run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

This will start both the Node.js application and an Oracle XE database container.

## Configuration Details

### Email Setup (Gmail)

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
3. Use this app password as `EMAIL_PASS` in your `.env` file

### Oracle Database Schema

The application expects an Oracle database with appropriate tables for energy consumption data. The database connection uses the XEPDB1 pluggable database by default.

### EPIAS API

The application connects to the EPIAS API endpoints:
- Authentication: `https://cas.epias.com.tr/cas/v1/tickets`
- Data Query: `https://epys.epias.com.tr/demand/v1/pre-notification/supplier/query`

## Usage

### Scheduled Operation

The application automatically runs scheduled tasks to collect energy data. The scheduling is configured using the `node-schedule` library.

### Manual Operation

You can also run the data collection manually by executing the main script:

```bash
node index.js
```

### Logs

Application logs are stored in the `logs/` directory with timestamps:
- Format: `YYYY-MM-DDTHH-mm-ss.log`
- Includes detailed information about API calls, database operations, and errors

## Data Flow

1. **Authentication**: Application authenticates with EPIAS API using provided credentials
2. **Data Fetching**: Retrieves energy consumption data for the specified period
3. **Database Storage**: Stores data in Oracle database with duplicate prevention
4. **Error Handling**: Monitors for errors and performs automatic rollback if needed
5. **Notifications**: Sends email alerts for significant events or errors

## Error Handling

The application includes comprehensive error handling:

- **API Errors**: Retries failed requests and logs detailed error information
- **Database Errors**: Handles connection issues and constraint violations
- **Data Rollback**: Automatically removes partially inserted data on critical errors
- **Email Alerts**: Notifies administrators of system issues

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Create an issue on [GitHub Issues](https://github.com/OrhunTokdemir/Staj-EnergyConsumption-nodejs/issues)
- Contact the maintainer: OrhunTokdemir

## Acknowledgments

- EPIAS (Energy Markets Operation Company) for providing the API
- Oracle for the database technology
- The Node.js and npm community for the excellent packages used in this project