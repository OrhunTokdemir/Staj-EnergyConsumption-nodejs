function insertEnergyData(db, items, kullanici) {
    return new Promise((resolve, reject) => {
        try {
            // Changed to INSERT OR IGNORE to skip duplicates
            const insert = db.prepare(`
                INSERT OR IGNORE INTO USER (
                    ADDRESS, ANNUALAVERAGECONSUMPTION, BILATERALCONSUMERGROUP, CITYID, CITYNAME,
                    CONNECTIONPOSITION, CONSUMPTINPOINTEIC, CONSUMPTIONPOINTID, CONTRACTPOWER,
                    CUSTOMERNO, DEMANDDIRECTION, DEMANDID, DEMANDSTATUS, DEMANDTYPE, DESCRIPTION,
                    DISTRICTID, DISTRICTNAME, LASTRESORTCONSUMERGROUP, MAINTARIFFGROUP, METERID,
                    NEWORGANIZATION, OLDORGANIZATION, OWNERORGANIZATION, PERIODDATE,
                    PROFILESUBSCRIPTIONGROUP, READINGORGANIZATION, READINGTYPE, SENDTOLASTSUPPLIER,
                    SUBSTATIONREGION, SUBSTATIONREGIONID, TARIFFCLASSTYPE, TITLE, UNIQUECODE, USAGETYPE, KULLANICI
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            items.forEach(item => {
                const values = [
                    item.address,
                    item.annualAverageConsumption,
                    getValue(item, 'bilateralConsumerGroup', 'value'),
                    item.cityId,
                    item.cityName,
                    getValue(item, 'connectionPositionDescriptionType', 'value'),
                    item.consumptionPointEic,
                    item.consumptionPointId,
                    item.contractPower,
                    item.customerNo,
                    getValue(item, 'demandDirection', 'value'),
                    item.demandId,
                    getValue(item, 'demandStatus', 'value'),
                    getValue(item, 'demandType', 'value'),
                    getValue(item, 'description', 'value'),
                    item.districtId,
                    item.districtName,
                    getValue(item, 'lastResortConsumerGroup', 'value'),
                    getValue(item, 'mainTariffGroup', 'value'),
                    item.meterId,
                    getValue(item, 'newOrganization', 'value'),
                    getValue(item, 'oldOrganization', 'value'),
                    getValue(item, 'ownerOrganization', 'value'),
                    item.periodDate,
                    getValue(item, 'profileSubscriptionGroup', 'value'),
                    getValue(item, 'readingOrganization', 'name'),
                    getValue(item, 'readingType', 'value'),
                    item.sendToLastSupplier ? 1 : 0,
                    null, // substationRegion
                    null, // substationRegionId
                    getValue(item, 'tariffClassType', 'value'),
                    item.title,
                    item.uniqueCode,
                    getValue(item, 'usageType', 'value'),
                    kullanici
                ];
                
                try {
                    const result = insert.run(...values);
                    // Track the changes (1 if inserted, 0 if ignored due to UNIQUE constraint)
                    if (result.changes === 0) {
                        console.log(`Skipped duplicate record: ${item.uniqueCode} - ${item.periodDate}`);
                    }
                } catch (err) {
                    console.error(`Error inserting record ${item.uniqueCode}: ${err.message}`);
                }
            });
            
            console.log(`Data insertion process completed for ${kullanici}`);
            resolve();
        } catch (error) {
            console.error('Database insertion error:', error.message);
            reject(error);
        }
    });
}

// Helper function to safely get nested values
function getValue(obj, key, subKey) {
    return obj[key] && obj[key][subKey] ? obj[key][subKey] : null;
}

// Function to close database connection properly
function closeDatabase(db) {
  if (!db) {
    console.log('Database connection is null or undefined');
    return;
  }
  
  if (!db.open) {
    console.log('Database connection is already closed');
    return;
  }
  
  try {
    // Run WAL checkpoint to commit all changes and force write to main database
    console.log('Running WAL checkpoint...');
    db.pragma('wal_checkpoint(FULL)');
    console.log('WAL checkpoint completed successfully');
    
    // Additional checkpoint to ensure all data is written
    db.pragma('wal_checkpoint(TRUNCATE)');
    console.log('WAL truncate checkpoint completed');
    
  } catch (err) {
    console.error('Error during WAL checkpoint:', err.message);
    // Continue with closing even if checkpoint fails
  }
  
  try {
    // Close the database connection
    db.close();
    console.log('Database connection closed successfully');
  } catch (err) {
    console.error('Error closing database:', err.message);
  }
}

// Function to delete rows for a specific user and period
function deleteRows(db, kullanici, periodDate) {
  if (db) {
    try {
      const deleteStmt = db.prepare(`
        DELETE FROM USER 
        WHERE KULLANICI = ? AND PERIODDATE = ?
      `);
      
      const result = deleteStmt.run(kullanici, periodDate);
      console.log(`Deleted ${result.changes} rows for ${kullanici} with period ${periodDate}`);
      return result.changes;
    } catch (error) {
      console.error(`Error deleting rows for ${kullanici}:`, error.message);
      throw error;
    }
  }
}

module.exports = {
    insertEnergyData,
    closeDatabase,
    deleteRows
};