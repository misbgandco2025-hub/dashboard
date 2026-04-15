// Application-wide constants

export const ROLES = {
  ADMIN: 'admin',
  DATA_ENTRY: 'data-entry',
  VIEWER: 'viewer',
};

export const STATUS_COLORS = {
  'Documentation In Progress': 'blue',
  'Documentation Completed': 'green',
  'Portal Registration Pending': 'yellow',
  'Portal Registration Completed': 'green',
  'Application Submitted to Bank': 'purple',
  'Application Submitted': 'purple',
  'Under Bank Review': 'orange',
  'Under Review': 'orange',
  'Site Inspection Scheduled': 'yellow',
  'Site Inspection Completed': 'green',
  'Technical Evaluation Pending': 'yellow',
  'Query Raised by Bank': 'red',
  'Query Raised': 'red',
  'Query Resolved': 'green',
  'Sent for Approval': 'purple',
  'Recommended for Approval': 'purple',
  'Approved': 'green',
  'Rejected': 'red',
  'Disbursement Pending': 'yellow',
  'Disbursement Completed': 'emerald',
  'Subsidy Release Pending': 'yellow',
  'Subsidy Released': 'emerald',
  'Subsidy Received': 'emerald',
};

export const BADGE_COLORS = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  orange: 'bg-orange-100 text-orange-800',
  red: 'bg-red-100 text-red-800',
  purple: 'bg-purple-100 text-purple-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  gray: 'bg-gray-100 text-gray-700',
  pink: 'bg-pink-100 text-pink-800',
};

export const DOCUMENT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'received', label: 'Received' },
];

export const DOCUMENT_STATUS_COLORS = {
  'pending': 'gray',
  'received': 'green',
};

export const QUERY_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export const QUERY_STATUS_COLORS = {
  'open': 'red',
  'in-progress': 'yellow',
  'resolved': 'green',
  'closed': 'gray',
};

export const QUERY_CATEGORIES = [
  { value: 'documentation', label: 'Documentation' },
  { value: 'technical', label: 'Technical' },
  { value: 'financial', label: 'Financial' },
  { value: 'other', label: 'Other' },
];

export const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const PRIORITY_COLORS = {
  low: 'green',
  medium: 'yellow',
  high: 'red',
};

export const SOURCE_TYPES = [
  { value: 'vendor', label: 'Vendor' },
  { value: 'direct', label: 'Direct' },
];

export const CLIENT_TYPES = [
  { value: 'bank-loan', label: 'Bank Loan' },
  { value: 'subsidy', label: 'Subsidy' },
  { value: 'both', label: 'Both' },
];

export const CLIENT_TYPE_COLORS = {
  'bank-loan': 'blue',
  'subsidy': 'purple',
  'both': 'emerald',
};

export const ROLES_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'data-entry', label: 'Data Entry' },
  { value: 'viewer', label: 'Viewer' },
];

export const ROLE_COLORS = {
  admin: 'red',
  'data-entry': 'blue',
  viewer: 'gray',
};

export const PORTAL_NAMES = [
  { value: 'AIF', label: 'AIF Portal' },
  { value: 'NABARD', label: 'NABARD Portal' },
  { value: 'State Portal', label: 'State Portal' },
  { value: 'PMEGP', label: 'PMEGP Portal' },
  { value: 'MUDRA', label: 'MUDRA Portal' },
  { value: 'Other', label: 'Other' },
];

export const REGISTRATION_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

export const APPROVAL_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'query-raised', label: 'Query Raised' },
];

export const ACTIVITY_TYPE_ICONS = {
  'status-change': '🔄',
  'document-update': '📄',
  'query': '❓',
  'note': '📝',
  'portal-update': '🌐',
  'assignment': '👤',
};

export const PAGE_SIZES = [10, 25, 50, 100];

export const NOTIFICATION_COLORS = {
  query: 'red',
  'status-change': 'blue',
  assignment: 'purple',
  document: 'orange',
  reminder: 'yellow',
};

export const COMMON_BANKS = [
  'State Bank of India',
  'Bank of Baroda',
  'Punjab National Bank',
  'Canara Bank',
  'Union Bank of India',
  'Bank of India',
  'Indian Bank',
  'Central Bank of India',
  'UCO Bank',
  'Bank of Maharashtra',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'IndusInd Bank',
  'Yes Bank',
  'IDFC First Bank',
  'Federal Bank',
  'South Indian Bank',
  'Karnataka Bank',
  'Other',
];
