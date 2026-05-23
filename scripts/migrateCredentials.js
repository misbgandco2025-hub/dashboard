const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Client = require('../models/Client');
const SubsidyApplication = require('../models/SubsidyApplication');
const BankLoanApplication = require('../models/BankLoanApplication');

const migrateCredentials = async () => {
  try {
    // Connect to DB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mis_bhavdip';
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB. Starting migration...');

    // 1. Migrate Subsidy Applications (GOC and NHB credentials)
    const subsidyApps = await SubsidyApplication.find({ isDeleted: false });
    let migratedGoc = 0;
    let migratedNhb = 0;

    for (const app of subsidyApps) {
      // NOTE: Using schema in strict mode might omit gocCredentials if we removed it from schema, 
      // so we use app.get('gocCredentials') or app._doc to access fields removed from schema.
      const goc = app._doc.gocCredentials;
      const nhb = app._doc.nhbDetails;
      
      let clientUpdated = false;
      const client = await Client.findById(app.clientId);
      if (!client) continue;

      // Migrate GOC
      if (goc && (goc.userId || goc.email || goc.mobile || goc._passwordEncrypted)) {
        if (!client.gocCredentials) client.gocCredentials = {};
        
        // We only overwrite if the app has a value, giving preference to the latest processed
        if (goc.userId) client.gocCredentials.userId = goc.userId;
        if (goc.email) client.gocCredentials.email = goc.email;
        if (goc.mobile) client.gocCredentials.mobile = goc.mobile;
        if (goc._passwordEncrypted) client.gocCredentials._passwordEncrypted = goc._passwordEncrypted;
        
        clientUpdated = true;
        migratedGoc++;
      }

      // Migrate NHB
      if (nhb && (nhb.nhbId || nhb._nhbPasswordEncrypted)) {
        if (!client.nhbCredentials) client.nhbCredentials = {};
        
        if (nhb.nhbId) client.nhbCredentials.nhbId = nhb.nhbId;
        if (nhb._nhbPasswordEncrypted) client.nhbCredentials._passwordEncrypted = nhb._nhbPasswordEncrypted;
        
        clientUpdated = true;
        migratedNhb++;
      }

      if (clientUpdated) {
        client.markModified('gocCredentials');
        client.markModified('nhbCredentials');
        await client.save();
      }
    }

    console.log(`Finished migrating Subsidies: migrated ${migratedGoc} GOC credentials and ${migratedNhb} NHB credentials.`);

    // 2. Migrate Bank Loan Applications (AIF credentials)
    const loanApps = await BankLoanApplication.find({ isDeleted: false });
    let migratedAif = 0;

    for (const app of loanApps) {
      const aif = app._doc.aifCredentials;
      if (!aif || (!aif.email && !aif.mobile && !aif._passwordEncrypted)) continue;

      const client = await Client.findById(app.clientId);
      if (!client) continue;

      if (!client.aifCredentials) client.aifCredentials = {};
      
      if (aif.email) client.aifCredentials.email = aif.email;
      if (aif.mobile) client.aifCredentials.mobile = aif.mobile;
      if (aif._passwordEncrypted) client.aifCredentials._passwordEncrypted = aif._passwordEncrypted;

      client.markModified('aifCredentials');
      await client.save();
      migratedAif++;
    }

    console.log(`Finished migrating Bank Loans: migrated ${migratedAif} AIF credentials.`);

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrateCredentials();
