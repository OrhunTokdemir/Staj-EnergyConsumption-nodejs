
const { getValue } = require('./dbMethods');
const { setupOracleDatabase } = require('./Oracledb');

// Insert energy data into OracleDB using MERGE to avoid duplicates
async function insertEnergyDataOracle(items, kullanici) {
    const connection = await setupOracleDatabase();
    const mergeSql = `
        MERGE INTO ENERGY_CONSUMPTION ec
        USING (SELECT :UNIQUECODE AS UNIQUECODE, :PERIODDATE AS PERIODDATE, :KULLANICI AS KULLANICI FROM dual) src
        ON (ec.UNIQUECODE = src.UNIQUECODE AND ec.PERIODDATE = src.PERIODDATE AND ec.KULLANICI = src.KULLANICI)
        WHEN NOT MATCHED THEN
        INSERT (
            ADDRESS, ANNUALAVERAGECONSUMPTION, BILATERALCONSUMERGROUP, CITYID, CITYNAME,
            CONNECTIONPOSITION, CONSUMPTINPOINTEIC, CONSUMPTIONPOINTID, CONTRACTPOWER,
            CUSTOMERNO, DEMANDDIRECTION, DEMANDID, DEMANDSTATUS, DEMANDTYPE, DESCRIPTION,
            DISTRICTID, DISTRICTNAME, LASTRESORTCONSUMERGROUP, MAINTARIFFGROUP, METERID,
            NEWORGANIZATION, OLDORGANIZATION, OWNERORGANIZATION, PERIODDATE,
            PROFILESUBSCRIPTIONGROUP, READINGORGANIZATION, READINGTYPE, SENDTOLASTSUPPLIER,
            SUBSTATIONREGION, SUBSTATIONREGIONID, TARIFFCLASSTYPE, TITLE, UNIQUECODE, USAGETYPE, KULLANICI
        ) VALUES (
            :ADDRESS, :ANNUALAVERAGECONSUMPTION, :BILATERALCONSUMERGROUP, :CITYID, :CITYNAME,
            :CONNECTIONPOSITION, :CONSUMPTINPOINTEIC, :CONSUMPTIONPOINTID, :CONTRACTPOWER,
            :CUSTOMERNO, :DEMANDDIRECTION, :DEMANDID, :DEMANDSTATUS, :DEMANDTYPE, :DESCRIPTION,
            :DISTRICTID, :DISTRICTNAME, :LASTRESORTCONSUMERGROUP, :MAINTARIFFGROUP, :METERID,
            :NEWORGANIZATION, :OLDORGANIZATION, :OWNERORGANIZATION, :PERIODDATE,
            :PROFILESUBSCRIPTIONGROUP, :READINGORGANIZATION, :READINGTYPE, :SENDTOLASTSUPPLIER,
            :SUBSTATIONREGION, :SUBSTATIONREGIONID, :TARIFFCLASSTYPE, :TITLE, :UNIQUECODE, :USAGETYPE, :KULLANICI
        )`;

    for (const item of items) {
        const bindParams = {
            ADDRESS: item.address,
            ANNUALAVERAGECONSUMPTION: item.annualAverageConsumption,
            BILATERALCONSUMERGROUP: getValue(item, 'bilateralConsumerGroup', 'value'),
            CITYID: item.cityId,
            CITYNAME: item.cityName,
            CONNECTIONPOSITION: getValue(item, 'connectionPositionDescriptionType', 'value'),
            CONSUMPTINPOINTEIC: item.consumptionPointEic,
            CONSUMPTIONPOINTID: item.consumptionPointId,
            CONTRACTPOWER: item.contractPower,
            CUSTOMERNO: item.customerNo,
            DEMANDDIRECTION: getValue(item, 'demandDirection', 'value'),
            DEMANDID: item.demandId,
            DEMANDSTATUS: getValue(item, 'demandStatus', 'value'),
            DEMANDTYPE: getValue(item, 'demandType', 'value'),
            DESCRIPTION: getValue(item, 'description', 'value'),
            DISTRICTID: item.districtId,
            DISTRICTNAME: item.districtName,
            LASTRESORTCONSUMERGROUP: getValue(item, 'lastResortConsumerGroup', 'value'),
            MAINTARIFFGROUP: getValue(item, 'mainTariffGroup', 'value'),
            METERID: item.meterId,
            NEWORGANIZATION: getValue(item, 'newOrganization', 'value'),
            OLDORGANIZATION: getValue(item, 'oldOrganization', 'value'),
            OWNERORGANIZATION: getValue(item, 'ownerOrganization', 'value'),
            PERIODDATE: item.periodDate,
            PROFILESUBSCRIPTIONGROUP: getValue(item, 'profileSubscriptionGroup', 'value'),
            READINGORGANIZATION: getValue(item, 'readingOrganization', 'name'),
            READINGTYPE: getValue(item, 'readingType', 'value'),
            SENDTOLASTSUPPLIER: item.sendToLastSupplier ? 1 : 0,
            SUBSTATIONREGION: null, // Not available in item
            SUBSTATIONREGIONID: null, // Not available in item
            TARIFFCLASSTYPE: getValue(item, 'tariffClassType', 'value'),
            TITLE: item.title,
            UNIQUECODE: item.uniqueCode,
            USAGETYPE: getValue(item, 'usageType', 'value'),
            KULLANICI: kullanici
        };
        try {
            await connection.execute(mergeSql, bindParams, { autoCommit: true });
        } catch (err) {
            if (err.errorNum === 1) { // ORA-00001: unique constraint violated
                console.log(`Skipped duplicate record: ${item.uniqueCode} - ${item.periodDate}`);
            } else {
                console.error(`Error inserting record ${item.uniqueCode}: ${err.message}`);
            }
        }
    }
    console.log(`Data insertion process completed for ${kullanici}`);
}

// Function to close OracleDB connection
async function closeDatabaseOracle(connection) {
    if (connection) {
        try {
            await connection.close();
            console.log('OracleDB connection closed successfully');
            return true;
        } catch (err) {
            console.error('Error closing OracleDB connection:', err.message);
            return false;
        }
    } else {
        console.log('OracleDB connection is null or undefined');
        return false;
    }
}

// Function to delete rows for a specific user and period in OracleDB
async function deleteRowsOracle(kullanici, periodDate) {
    const connection = await setupOracleDatabase();
    try {
        const result = await connection.execute(
            `DELETE FROM ENERGY_CONSUMPTION WHERE KULLANICI = :kullanici AND PERIODDATE = :periodDate`,
            { kullanici, periodDate },
            { autoCommit: true }
        );
        console.log(`Deleted ${result.rowsAffected} rows for ${kullanici} with period ${periodDate}`);
        return result.rowsAffected;
    } catch (error) {
        console.error(`Error deleting rows for ${kullanici}:`, error.message);
        throw error;
    }
}

module.exports = {
    insertEnergyDataOracle,
    closeDatabaseOracle,
    deleteRowsOracle,
    getValue
};