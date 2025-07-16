const { insertEnergyData } = require('./dbMethods.js');
const Database = require('better-sqlite3');

let db;

function setupDatabase(dbPath = 'Energydata.db') {
    // If the database connection is already open, return it.
    if (db) {
        return db;
    }

    // Otherwise, create a new connection.
    // Removed verbose logging to prevent SQL statements from being printed
    db = new Database(dbPath);

    console.log('Database connection established.');

    // Run the initial schema setup.
    db.exec(`CREATE TABLE IF NOT EXISTS K1(
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        ADDRESS TEXT,
        ANNUALAVERAGECONSUMPTION REAL,
        BILATERALCONSUMERGROUP TEXT,
        CITYID INTEGER,
        CITYNAME TEXT,
        CONNECTIONPOSITION TEXT,
        CONSUMPTINPOINTEIC TEXT,
        CONSUMPTIONPOINTID INTEGER,
        CONTRACTPOWER REAL,
        CUSTOMERNO TEXT,
        DEMANDDIRECTION TEXT,
        DEMANDID INTEGER,
        DEMANDSTATUS TEXT,
        DEMANDTYPE TEXT,
        DESCRIPTION TEXT,
        DISTRICTID INTEGER,
        DISTRICTNAME TEXT,
        LASTRESORTCONSUMERGROUP TEXT,
        MAINTARIFFGROUP TEXT,
        METERID INTEGER,
        NEWORGANIZATION TEXT,  -- This is set as text for now
        OLDORGANIZATION TEXT, -- This is set as text for now
        OWNERORGANIZATION TEXT, -- This is set as text for now
        PERIODDATE TEXT,
        PROFILESUBSCRIPTIONGROUP TEXT,
        READINGORGANIZATION TEXT,
        READINGTYPE TEXT,
        SENDTOLASTSUPPLIER INTEGER,
        SUBSTATIONREGION TEXT NULL, -- bu alanin herhangi bir ornegini jsonda bulamadim.
        SUBSTATIONREGIONID INTEGER NULL, -- bu alanin herhangi bir ornegini jsonda bulamadim.
        TARIFFCLASSTYPE TEXT,
        TITLE TEXT,
        UNIQUECODE TEXT, -- primary kod konusunda emin değilim, farkli zamanlarda alinan ornekler olabilir
        USAGETYPE TEXT,
        KULLANICI TEXT,
        CREATEDTIME TEXT DEFAULT (datetime('now','localtime')),
        UNIQUE(UNIQUECODE, PERIODDATE, KULLANICI)
    )`);

    // Set pragma for performance and proper WAL mode configuration
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 1000');
    db.pragma('temp_store = memory');
    db.pragma('mmap_size = 268435456'); // 256MB
    
    // Set WAL autocheckpoint to ensure regular checkpoints
    db.pragma('wal_autocheckpoint = 1000');

    console.log('Database schema is ready.');

    // Return the single database instance.
    return db;
}

// Function to create a new database connection (for scheduled jobs)
function createNewDatabaseConnection(dbPath = 'Energydata.db') {
    // Always create a new connection
    const newDb = new Database(dbPath);

    console.log('New database connection established for scheduled job.');

    // Run the initial schema setup.
    newDb.exec(`CREATE TABLE IF NOT EXISTS K1(
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        ADDRESS TEXT,
        ANNUALAVERAGECONSUMPTION REAL,
        BILATERALCONSUMERGROUP TEXT,
        CITYID INTEGER,
        CITYNAME TEXT,
        CONNECTIONPOSITION TEXT,
        CONSUMPTINPOINTEIC TEXT,
        CONSUMPTIONPOINTID INTEGER,
        CONTRACTPOWER REAL,
        CUSTOMERNO TEXT,
        DEMANDDIRECTION TEXT,
        DEMANDID INTEGER,
        DEMANDSTATUS TEXT,
        DEMANDTYPE TEXT,
        DESCRIPTION TEXT,
        DISTRICTID INTEGER,
        DISTRICTNAME TEXT,
        LASTRESORTCONSUMERGROUP TEXT,
        MAINTARIFFGROUP TEXT,
        METERID INTEGER,
        NEWORGANIZATION TEXT,  -- This is set as text for now
        OLDORGANIZATION TEXT, -- This is set as text for now
        OWNERORGANIZATION TEXT, -- This is set as text for now
        PERIODDATE TEXT,
        PROFILESUBSCRIPTIONGROUP TEXT,
        READINGORGANIZATION TEXT,
        READINGTYPE TEXT,
        SENDTOLASTSUPPLIER INTEGER,
        SUBSTATIONREGION TEXT NULL, -- bu alanin herhangi bir ornegini jsonda bulamadim.
        SUBSTATIONREGIONID INTEGER NULL, -- bu alanin herhangi bir ornegini jsonda bulamadim.
        TARIFFCLASSTYPE TEXT,
        TITLE TEXT,
        UNIQUECODE TEXT, -- primary kod konusunda emin değilim, farkli zamanlarda alinan ornekler olabilir
        USAGETYPE TEXT,
        KULLANICI TEXT,
        CREATEDTIME TEXT DEFAULT (datetime('now','localtime')),
        UNIQUE(UNIQUECODE, PERIODDATE, KULLANICI)
    )`);

    // Set pragma for performance and proper WAL mode configuration
    newDb.pragma('journal_mode = WAL');
    newDb.pragma('synchronous = NORMAL');
    newDb.pragma('cache_size = 1000');
    newDb.pragma('temp_store = memory');
    newDb.pragma('mmap_size = 268435456'); // 256MB
    
    // Set WAL autocheckpoint to ensure regular checkpoints
    newDb.pragma('wal_autocheckpoint = 1000');

    console.log('New database connection schema is ready.');

    // Return the new database instance
    return newDb;
}

// Export the setup function and new connection function
module.exports = setupDatabase;
module.exports.createNewDatabaseConnection = createNewDatabaseConnection;