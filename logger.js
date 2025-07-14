const fs = require('fs');
const path = require('path');
const util = require('util');

/**
 * Format date for filename (YYYY-MM-DD-HH-MM-SS)
 * @param {Date} date - Date object to format
 * @returns {string} - Formatted date string for filename
 */
function formatDateTimeForFilename(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
}

/**
 * Sets up logging to redirect console output to a file named by date and time
 * @param {Date|string} dateTime - Date object or string to use in the filename
 * @param {boolean} consoleOutput - Whether to also show output in the console (default: true)
 * @returns {Function} - Function to restore original console behavior
 */
function setupLogger(dateTime, consoleOutput = true) {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir);
    }
    
    // Format filename with date and time if a Date object is provided
    let logFileName;
    if (dateTime instanceof Date) {
        logFileName = formatDateTimeForFilename(dateTime);
    } else {
        // If string is provided, use it directly
        logFileName = dateTime;
    }
    
    // Create log filename with .log extension
    const logFile = path.join(logsDir, `${logFileName}.log`);
    
    // Create a write stream to the log file (append mode)
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    
    // Store original console methods
    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
    };
    
    // Override console.log
    console.log = function() {
        const message = util.format.apply(null, arguments);
        logStream.write(`[${new Date().toISOString()}] [LOG] ${message}\n`);
        
        // Also log to the original console if requested
        if (consoleOutput) {
            originalConsole.log.apply(console, arguments);
        }
    };
    
    // Override console.error
    console.error = function() {
        const message = util.format.apply(null, arguments);
        logStream.write(`[${new Date().toISOString()}] [ERROR] ${message}\n`);
        
        // Always show errors in the console
        originalConsole.error.apply(console, arguments);
    };
    
    // Override console.warn
    console.warn = function() {
        const message = util.format.apply(null, arguments);
        logStream.write(`[${new Date().toISOString()}] [WARN] ${message}\n`);
        
        if (consoleOutput) {
            originalConsole.warn.apply(console, arguments);
        }
    };
    
    // Override console.info
    console.info = function() {
        const message = util.format.apply(null, arguments);
        logStream.write(`[${new Date().toISOString()}] [INFO] ${message}\n`);
        
        if (consoleOutput) {
            originalConsole.info.apply(console, arguments);
        }
    };
    
    console.log(`Logging started: Output is being saved to ${logFile}`);
    
    // Return a function to restore original console behavior
    return function cleanupLogger() {
        console.log = originalConsole.log;
        console.error = originalConsole.error;
        console.warn = originalConsole.warn;
        console.info = originalConsole.info;
        logStream.end();
        return `Logging to ${logFile} has ended.`;
    };
}

module.exports = setupLogger;