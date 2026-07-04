// ============================================================
// scripts/generateMockData.js
// Generates 10,000+ mock audit logs for bulk upload testing
// Run via: node scripts/generateMockData.js
// ============================================================
const fs = require('fs');
const path = require('path');

const TOTAL_RECORDS = 15000;
const OUTPUT_FILE = path.join(__dirname, 'mock_logs.json');

// Real-world domain data
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['Resolved', 'Unresolved', 'In Progress'];
const REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-south-1', 'ap-southeast-1', 'ap-northeast-1', 'sa-east-1'];
const ROLES = ['admin', 'developer', 'analyst', 'security_engineer', 'auditor', 'system'];
const RESOURCE_TYPES = ['USER', 'ROLE', 'API', 'DATABASE', 'FILE', 'CONFIG', 'NETWORK', 'SERVICE'];

const ACTIONS = {
  USER: ['CREATE_USER', 'DELETE_USER', 'UPDATE_USER', 'RESET_PASSWORD', 'LOGIN', 'LOGOUT', 'FAILED_LOGIN'],
  ROLE: ['GRANT_ROLE', 'REVOKE_ROLE', 'UPDATE_POLICY'],
  API: ['API_KEY_CREATED', 'API_KEY_REVOKED', 'RATE_LIMIT_EXCEEDED'],
  DATABASE: ['DB_DUMP', 'QUERY_EXECUTION', 'BACKUP_CREATED', 'DATA_EXPORT'],
  FILE: ['FILE_UPLOADED', 'FILE_DELETED', 'FILE_DOWNLOADED', 'PERMISSIONS_CHANGED'],
  CONFIG: ['CONFIG_UPDATED', 'SECRET_ACCESSED'],
  NETWORK: ['FIREWALL_RULE_ADDED', 'PORT_OPENED', 'VPN_CONNECTED'],
  SERVICE: ['SERVICE_STARTED', 'SERVICE_STOPPED', 'RESTART_INITIATED']
};

const DOMAINS = ['company.com', 'internal.net', 'vendor.io', 'contractor.org'];
const FIRST_NAMES = ['priya', 'alex', 'sam', 'jordan', 'taylor', 'casey', 'morgan', 'riley', 'system'];
const LAST_NAMES = ['nair', 'smith', 'chen', 'patel', 'kim', 'garcia', 'jones', 'wang', 'service'];

// Weighted random selection helpers
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedSeverity() {
  const rand = Math.random();
  if (rand < 0.6) return 'LOW';        // 60%
  if (rand < 0.85) return 'MEDIUM';    // 25%
  if (rand < 0.96) return 'HIGH';      // 11%
  return 'CRITICAL';                   // 4%
}

function generateIp() {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function generateEmail() {
  const first = randomChoice(FIRST_NAMES);
  if (first === 'system') return 'system@internal.net';
  const last = randomChoice(LAST_NAMES);
  const domain = randomChoice(DOMAINS);
  return `${first}.${last}@${domain}`;
}

// Generate records
console.log(`Generating ${TOTAL_RECORDS} mock log records...`);
const records = [];
const now = new Date();
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

for (let i = 0; i < TOTAL_RECORDS; i++) {
  const resourceType = randomChoice(RESOURCE_TYPES);
  const action = randomChoice(ACTIONS[resourceType]);
  
  // Random time within the last 30 days
  const timestamp = new Date(now.getTime() - Math.random() * THIRTY_DAYS_MS).toISOString();
  
  records.push({
    actor: generateEmail(),
    role: randomChoice(ROLES),
    action,
    resource: `/${resourceType.toLowerCase()}/${action.toLowerCase().replace('_', '-')}/${Math.floor(Math.random() * 10000)}`,
    resourceType,
    ipAddress: generateIp(),
    region: randomChoice(REGIONS),
    severity: weightedSeverity(),
    status: randomChoice(STATUSES),
    timestamp
  });
}

// Write to file
console.log(`Writing to ${OUTPUT_FILE}...`);
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(records, null, 2));
console.log(`✅ Successfully generated ${TOTAL_RECORDS} records.`);
