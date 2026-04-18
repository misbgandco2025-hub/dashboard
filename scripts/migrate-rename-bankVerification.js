/**
 * Migration: Rename bankVerificationStatus → gocBankVerificationStatus
 *
 * Run ONCE on MongoDB before deploying the new code.
 *
 * Usage:
 *   node scripts/migrate-rename-bankVerification.js
 *
 * ⚠️  ALWAYS BACKUP YOUR DATABASE FIRST!
 *   mongodump --db your_db_name --out ./backup-$(date +%F)
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function run() {
  if (!MONGO_URI) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const db = mongoose.connection.db;
  const collection = db.collection('subsidyapplications');

  // 1. Rename bankVerificationStatus → gocBankVerificationStatus
  const result1 = await collection.updateMany(
    { bankVerificationStatus: { $exists: true } },
    { $rename: { 'bankVerificationStatus': 'gocBankVerificationStatus' } }
  );
  console.log(`✅ Renamed bankVerificationStatus → gocBankVerificationStatus (${result1.modifiedCount} docs)`);

  // 2. Rename bankVerificationDate → gocBankVerificationDate
  const result2 = await collection.updateMany(
    { bankVerificationDate: { $exists: true } },
    { $rename: { 'bankVerificationDate': 'gocBankVerificationDate' } }
  );
  console.log(`✅ Renamed bankVerificationDate → gocBankVerificationDate (${result2.modifiedCount} docs)`);

  // 3. Initialize lastStatusChangeDate for existing records (set to updatedAt)
  const result3 = await collection.updateMany(
    { lastStatusChangeDate: { $exists: false } },
    [{ $set: { lastStatusChangeDate: '$updatedAt' } }]
  );
  console.log(`✅ Set lastStatusChangeDate from updatedAt (${result3.modifiedCount} docs)`);

  // 4. Initialize new sub-documents with defaults for existing records
  const result4 = await collection.updateMany(
    { loanPreparation: { $exists: false } },
    {
      $set: {
        loanPreparation:  { preparationStatus: 'not-started' },
        bankSubmission:   { submissionStatus: 'not-submitted' },
        bankLoanSanction: { sanctionStatus: 'pending' },
        subsidyClaim:     { claimStatus: 'not-submitted' },
      }
    }
  );
  console.log(`✅ Initialized new sub-documents (${result4.modifiedCount} docs)`);

  console.log('\n🎉 Migration complete!');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
