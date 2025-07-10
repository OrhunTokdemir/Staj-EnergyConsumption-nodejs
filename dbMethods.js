function insertEnergyData(db, items, kullanici) {
    return new Promise((resolve, reject) => {
        try {
            const insert = db.prepare(`
                INSERT INTO K1 (
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
                
                insert.run(...values);
            });
            
            console.log(`Successfully inserted ${items.length} records into database`);
            resolve();
        } catch (error) {
            console.error('Database insertion error:', error.message);
            reject(error);
        }
    });
}

// Helper function
function getValue(obj, key, subKey) {
    return obj[key] && obj[key][subKey] ? obj[key][subKey] : null;
}

module.exports = { insertEnergyData };