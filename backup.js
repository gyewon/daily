const fs = require('fs');
const path = require('path');
const https = require('https');

const supabaseUrl = 'https://jkuuwmuniuvijvbtvwde.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE';

const tables = ['app_settings', 'category_rules', 'deleted_records'];

const backupDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
}

function fetchTable(table) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'jkuuwmuniuvijvbtvwde.supabase.co',
      path: `/rest/v1/${table}?select=*`,
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', e => reject(e));
    req.end();
  });
}

async function runBackup() {
  const dateStr = new Date().toISOString().split('T')[0];
  const backupData = {};
  
  console.log('Starting Supabase backup...');
  for (const table of tables) {
    try {
      console.log(`Fetching table: ${table}...`);
      const data = await fetchTable(table);
      backupData[table] = data;
    } catch (e) {
      console.error(`Error fetching table ${table}:`, e);
    }
  }
  
  const filePath = path.join(backupDir, `backup_${dateStr}.json`);
  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`Backup successfully saved to: ${filePath}`);

  // Git 자동 커밋 및 푸시
  console.log('Committing and pushing to Git...');
  const { execSync } = require('child_process');
  try {
    execSync('git add .');
    const status = execSync('git status --porcelain').toString();
    if (status.trim() !== '') {
      execSync(`git commit -m "Auto backup ${dateStr}"`);
      execSync('git push');
      console.log('Successfully pushed to Git.');
    } else {
      console.log('No changes to commit to Git.');
    }
  } catch (err) {
    console.error('Error during Git backup:', err.message);
  }
}

runBackup();
