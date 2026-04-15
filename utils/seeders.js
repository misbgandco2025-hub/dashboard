require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const FieldConfiguration = require('../models/FieldConfiguration');
const StatusOption = require('../models/StatusOption');

const connectDB = require('../config/db');

// ─── Seed Data ────────────────────────────────────────────────────────────────

const users = [
  {
    username: 'admin',
    email: 'admin@example.com',
    password: 'Admin@123',
    fullName: 'System Administrator',
    role: 'admin',
    mobile: '9000000001',
    status: 'active',
  },
  {
    username: 'dataentry',
    email: 'dataentry@example.com',
    password: 'Data@123',
    fullName: 'Data Entry User',
    role: 'data-entry',
    mobile: '9000000002',
    status: 'active',
  },
  {
    username: 'viewer',
    email: 'viewer@example.com',
    password: 'Viewer@123',
    fullName: 'Viewer User',
    role: 'viewer',
    mobile: '9000000003',
    status: 'active',
  },
];

const vendors = [
  { vendorName: 'AgriFinance Partners', contactPerson: 'Ramesh Kumar', mobile: '9111111001', email: 'ramesh@agrifinance.com', address: 'Mumbai, Maharashtra', status: 'active' },
  { vendorName: 'Rural Credit Associates', contactPerson: 'Sunita Patel', mobile: '9111111002', email: 'sunita@ruralcredit.com', address: 'Pune, Maharashtra', status: 'active' },
  { vendorName: 'MSME Business Consultants', contactPerson: 'Vikram Singh', mobile: '9111111003', email: 'vikram@msme.in', address: 'Delhi, NCR', status: 'active' },
  { vendorName: 'Kisan Financial Services', contactPerson: 'Meena Devi', mobile: '9111111004', email: 'meena@kisanfin.com', address: 'Jaipur, Rajasthan', status: 'active' },
  { vendorName: 'SHG Subsidy Advisors', contactPerson: 'Anand Reddy', mobile: '9111111005', email: 'anand@shgadvisors.com', address: 'Hyderabad, Telangana', status: 'active' },
];

const bankLoanDocTypes = [
  { name: 'Aadhar Card', required: true, description: 'Government issued Aadhar card of applicant', displayOrder: 1 },
  { name: 'PAN Card', required: true, description: 'Permanent Account Number card', displayOrder: 2 },
  { name: 'Project Report', required: true, description: 'Detailed project report with cost estimates', displayOrder: 3 },
  { name: 'Land Documents', required: true, description: 'Ownership / lease documents of land / premises', displayOrder: 4 },
  { name: 'Quotations', required: true, description: 'Quotations for machinery, equipment, or construction', displayOrder: 5 },
  { name: 'Bank Statements', required: true, description: 'Last 12 months bank statements', displayOrder: 6 },
  { name: 'ITR', required: true, description: 'Income Tax Returns for last 3 years', displayOrder: 7 },
  { name: 'GST Certificate', required: false, description: 'GST registration certificate', displayOrder: 8 },
  { name: 'Udyam Registration', required: false, description: 'Udyam / MSME registration certificate', displayOrder: 9 },
  { name: 'Partnership Deed', required: false, description: 'Partnership deed (for partnership firms)', displayOrder: 10 },
  { name: 'Processing Fee Receipt', required: true, description: 'Bank processing fee payment receipt', displayOrder: 11 },
  { name: 'Consent Letter', required: true, description: 'Consent letter from applicant', displayOrder: 12 },
  { name: 'Photographs', required: true, description: 'Passport size photographs of applicant(s)', displayOrder: 13 },
  { name: 'Address Proof', required: true, description: 'Current address proof document', displayOrder: 14 },
  { name: 'Other Documents', required: false, description: 'Any other document as required by bank', displayOrder: 15 },
];

const subsidyDocTypes = [
  { name: 'Aadhar Card', required: true, description: 'Government issued Aadhar card of applicant', displayOrder: 1 },
  { name: 'PAN Card', required: true, description: 'Permanent Account Number card', displayOrder: 2 },
  { name: 'Caste Certificate', required: false, description: 'Caste certificate if applicable', displayOrder: 3 },
  { name: 'Land Documents', required: true, description: 'Ownership or lease documents for the project site', displayOrder: 4 },
  { name: 'Project Report', required: true, description: 'Detailed project report for the subsidy scheme', displayOrder: 5 },
  { name: 'Quotations', required: true, description: 'Quotations for items to be purchased', displayOrder: 6 },
  { name: 'MSME Registration', required: true, description: 'MSME / Udyam registration certificate', displayOrder: 7 },
  { name: 'Bank Details', required: true, description: 'Bank account details (passbook / cancelled cheque)', displayOrder: 8 },
  { name: 'Consent Letter', required: true, description: 'Consent letter from beneficiary', displayOrder: 9 },
  { name: 'Affidavit', required: false, description: 'Affidavit as per scheme requirement', displayOrder: 10 },
  { name: 'Scheme Documents', required: true, description: 'Scheme-specific documents as prescribed', displayOrder: 11 },
  { name: 'Other Documents', required: false, description: 'Any additional supporting documents', displayOrder: 12 },
];

const bankLoanStatuses = [
  'Documentation In Progress',
  'Documentation Completed',
  'Portal Registration Pending',
  'Portal Registration Completed',
  'Application Submitted to Bank',
  'Under Bank Review',
  'Site Inspection Scheduled',
  'Site Inspection Completed',
  'Technical Evaluation Pending',
  'Query Raised by Bank',
  'Query Resolved',
  'Sent for Approval',
  'Approved',
  'Rejected',
  'Disbursement Pending',
  'Disbursement Completed',
];

const subsidyStatuses = [
  'Documentation In Progress',
  'Documentation Completed',
  'Portal Registration Pending',
  'Portal Registration Completed',
  'Application Submitted',
  'Under Review',
  'Site Inspection Scheduled',
  'Site Inspection Completed',
  'Query Raised',
  'Query Resolved',
  'Recommended for Approval',
  'Approved',
  'Rejected',
  'Subsidy Release Pending',
  'Subsidy Released',
  'Subsidy Received',
];

// ─── Seeder ───────────────────────────────────────────────────────────────────

const seed = async () => {
  try {
    await connectDB();
    console.log('\n🌱 Starting database seed...\n');

    // ── Users ──
    console.log('👤 Seeding users...');
    for (const u of users) {
      const exists = await User.findOne({ username: u.username });
      if (exists) {
        console.log(`   ⚠️  User "${u.username}" already exists — skipping`);
        continue;
      }
      await User.create(u);
      console.log(`   ✅ Created user: ${u.username} (${u.role})`);
    }

    // ── Vendors ──
    console.log('\n🏢 Seeding vendors...');
    const savedVendors = [];
    for (const v of vendors) {
      const exists = await Vendor.findOne({ vendorName: v.vendorName });
      if (exists) {
        console.log(`   ⚠️  Vendor "${v.vendorName}" already exists — skipping`);
        savedVendors.push(exists);
        continue;
      }
      const saved = await Vendor.create(v);
      savedVendors.push(saved);
      console.log(`   ✅ Created vendor: ${saved.vendorName} (${saved.vendorId})`);
    }

    // ── Bank Loan Document Types ──
    console.log('\n📄 Seeding bank loan document types...');
    for (const doc of bankLoanDocTypes) {
      const exists = await FieldConfiguration.findOne({ name: doc.name, type: 'bank-loan' });
      if (exists) {
        console.log(`   ⚠️  Document type "${doc.name}" (bank-loan) already exists — skipping`);
        continue;
      }
      await FieldConfiguration.create({ ...doc, type: 'bank-loan' });
      console.log(`   ✅ Created document type: ${doc.name} [bank-loan] (required: ${doc.required})`);
    }

    // ── Subsidy Document Types ──
    console.log('\n📄 Seeding subsidy document types...');
    for (const doc of subsidyDocTypes) {
      const exists = await FieldConfiguration.findOne({ name: doc.name, type: 'subsidy' });
      if (exists) {
        console.log(`   ⚠️  Document type "${doc.name}" (subsidy) already exists — skipping`);
        continue;
      }
      await FieldConfiguration.create({ ...doc, type: 'subsidy' });
      console.log(`   ✅ Created document type: ${doc.name} [subsidy] (required: ${doc.required})`);
    }

    // ── Bank Loan Status Options ──
    console.log('\n🔄 Seeding bank loan status options...');
    for (let i = 0; i < bankLoanStatuses.length; i++) {
      const label = bankLoanStatuses[i];
      const exists = await StatusOption.findOne({ label, type: 'bank-loan' });
      if (exists) {
        console.log(`   ⚠️  Status "${label}" (bank-loan) already exists — skipping`);
        continue;
      }
      await StatusOption.create({ label, type: 'bank-loan', order: i + 1 });
      console.log(`   ✅ Created status: ${label} [bank-loan]`);
    }

    // ── Subsidy Status Options ──
    console.log('\n🔄 Seeding subsidy status options...');
    for (let i = 0; i < subsidyStatuses.length; i++) {
      const label = subsidyStatuses[i];
      const exists = await StatusOption.findOne({ label, type: 'subsidy' });
      if (exists) {
        console.log(`   ⚠️  Status "${label}" (subsidy) already exists — skipping`);
        continue;
      }
      await StatusOption.create({ label, type: 'subsidy', order: i + 1 });
      console.log(`   ✅ Created status: ${label} [subsidy]`);
    }

    console.log('\n✅ Database seeding completed successfully!\n');
    console.log('─────────────────────────────────────────');
    console.log('Default Login Credentials:');
    console.log('  Admin     → username: admin       | password: Admin@123');
    console.log('  DataEntry → username: dataentry   | password: Data@123');
    console.log('  Viewer    → username: viewer      | password: Viewer@123');
    console.log('─────────────────────────────────────────\n');

  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database connection closed.');
    process.exit(0);
  }
};

seed();
