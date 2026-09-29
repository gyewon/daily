import re

# 1. Update index.html
html_path = "d:/AI App/daily/index.html"
with open(html_path, "r", encoding="utf-8") as f:
    html = f.read()

# Inject Supabase JS before app.js
if "supabase-js" not in html:
    html = html.replace('<script src="app.js"></script>', '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n  <script src="app.js"></script>')

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html)

# 2. Update app.js
js_path = "d:/AI App/daily/app.js"
with open(js_path, "r", encoding="utf-8") as f:
    js = f.read()

# Supabase Initialization
supabase_init = """
const supabaseUrl = 'https://jkuuwmuniuvijvbtvwde.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
"""

# Insert Supabase init after constants
js = re.sub(r'(const CARD_STORAGE_KEY = [^\n]+\n)', r'\1\n' + supabase_init + '\n', js)

# Replace saveData
new_saveData = """
  async function saveData() {
    if (appState.records.length > 0) {
      const { error } = await supabase.from('records').upsert(appState.records);
      if (error) console.error("Supabase Save Error (records):", error);
    }
  }
"""
js = re.sub(r'function saveData\(\) \{[\s\S]*?localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(appState\.records\)\);\s*\}', new_saveData, js)

# Replace saveRules
new_saveRules = """
  async function saveRules() {
    await supabase.from('app_settings').upsert({ key: 'rules', value: appState.categoryRules });
  }
"""
js = re.sub(r'function saveRules\(\) \{[\s\S]*?localStorage\.setItem\(RULES_STORAGE_KEY, JSON\.stringify\(appState\.categoryRules\)\);\s*\}', new_saveRules, js)

# Replace saveMasterCategories
new_saveMaster = """
  async function saveMasterCategories() {
    await supabase.from('app_settings').upsert({ key: 'master_categories', value: appState.masterCategories });
  }
"""
js = re.sub(r'function saveMasterCategories\(\) \{[\s\S]*?localStorage\.setItem\(MASTER_CAT_STORAGE_KEY, JSON\.stringify\(appState\.masterCategories\)\);\s*\}', new_saveMaster, js)

# Replace saveFixedCategories
new_saveFixed = """
  async function saveFixedCategories() {
    await supabase.from('app_settings').upsert({ key: 'fixed_categories', value: Array.from(appState.fixedCategories) });
  }
"""
js = re.sub(r'function saveFixedCategories\(\) \{[\s\S]*?localStorage\.setItem\(FIXED_CAT_STORAGE_KEY, JSON\.stringify\(Array\.from\(appState\.fixedCategories\)\)\);\s*\}', new_saveFixed, js)

# Replace saveDeletedSignatures
new_saveDeleted = """
  async function saveDeletedSignatures() {
    await supabase.from('app_settings').upsert({ key: 'deleted_signatures', value: Array.from(appState.deletedSignatures) });
  }
"""
# Note: saveDeletedSignatures might not exist explicitly as a named function if it was inline, but in previous code it was `localStorage.setItem('daily_deleted_sigs_v1', ...)`
js = re.sub(r"localStorage\.setItem\('daily_deleted_sigs_v1', JSON\.stringify\(Array\.from\(appState\.deletedSignatures\)\)\);", "saveDeletedSignatures();", js)
if "async function saveDeletedSignatures" not in js:
    js = js.replace("async function saveData() {", new_saveDeleted + "\nasync function saveData() {")

# Replace loadData
new_loadData = """
  async function loadData() {
    console.log("Loading data from Supabase...");
    try {
      // 1. Load Settings
      const { data: settings, error: setErr } = await supabase.from('app_settings').select('*');
      if (settings) {
        settings.forEach(s => {
          if (s.key === 'rules') appState.categoryRules = s.value;
          if (s.key === 'master_categories') appState.masterCategories = s.value;
          if (s.key === 'fixed_categories') appState.fixedCategories = new Set(s.value);
          if (s.key === 'deleted_signatures') appState.deletedSignatures = new Set(s.value);
          if (s.key === 'notification_logs') appState.notificationLogs = s.value;
          if (s.key === 'card_config') CARD_CONFIG = s.value;
        });
      }

      if (Object.keys(appState.masterCategories).length === 0) {
        appState.masterCategories = JSON.parse(JSON.stringify(DEFAULT_MASTER_CATEGORIES));
      }

      // 2. Load Records
      const { data: records, error: recErr } = await supabase.from('records').select('*').order('id', { ascending: true });
      
      if (records && records.length > 0) {
        appState.records = records;
        let changed = autoFlagInstallments();
        appState.records.forEach(r => {
          if (r.isFixed === undefined || r.isFixed === null) {
            checkFixedCategory(r);
            changed = true;
          }
        });
        if (changed) saveData();
      }

    } catch (err) {
      console.error("Supabase load error:", err);
    }
    
    // Fallback if completely empty
    if (!appState.records || appState.records.length === 0) {
      if (window.INITIAL_DATA && window.INITIAL_DATA.records && window.INITIAL_DATA.records.length > 0) {
        appState.records = [...window.INITIAL_DATA.records];
        saveData();
      }
    }
  }
"""
js = re.sub(r'async function loadData\(\) \{[\s\S]*?\} catch \(err\) \{\}[\s\S]*?saveData\(\);\s*\}\s*\}\s*\}', new_loadData, js)
# Note: the regex for loadData might be tricky, let's use string replace carefully instead if regex fails.
# Actually, since it's `async function loadData() {`, I'll use a simpler replace block.

with open("d:/AI App/daily/scratch/refactor_supabase.py", "w", encoding="utf-8") as script:
    script.write('''
import re

html_path = "d:/AI App/daily/index.html"
with open(html_path, "r", encoding="utf-8") as f:
    html = f.read()

if "supabase-js" not in html:
    html = html.replace(\'<script src="app.js"></script>\', \'<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\\n  <script src="app.js"></script>\')

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html)

js_path = "d:/AI App/daily/app.js"
with open(js_path, "r", encoding="utf-8") as f:
    js = f.read()

supabase_init = """
const supabaseUrl = 'https://jkuuwmuniuvijvbtvwde.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
"""
if "supabaseUrl" not in js:
    js = re.sub(r'(const CARD_STORAGE_KEY = [^\\n]+\\n)', r'\\1\\n' + supabase_init + '\\n', js)

js = re.sub(r'function saveData\(\) \\{[\\s\\S]*?localStorage\\.setItem\\(STORAGE_KEY, JSON\\.stringify\\(appState\\.records\\)\\);\\s*\\}', """  async function saveData() {
    if (appState.records.length > 0) {
      const { error } = await supabase.from('records').upsert(appState.records);
      if (error) console.error("Supabase Save Error (records):", error);
    }
  }""", js)

js = re.sub(r'function saveRules\(\) \\{[\\s\\S]*?localStorage\\.setItem\\(RULES_STORAGE_KEY, JSON\\.stringify\\(appState\\.categoryRules\\)\\);\\s*\\}', """  async function saveRules() {
    await supabase.from('app_settings').upsert({ key: 'rules', value: appState.categoryRules });
  }""", js)

js = re.sub(r'function saveMasterCategories\(\) \\{[\\s\\S]*?localStorage\\.setItem\\(MASTER_CAT_STORAGE_KEY, JSON\\.stringify\\(appState\\.masterCategories\\)\\);\\s*\\}', """  async function saveMasterCategories() {
    await supabase.from('app_settings').upsert({ key: 'master_categories', value: appState.masterCategories });
  }""", js)

js = re.sub(r'function saveFixedCategories\(\) \\{[\\s\\S]*?localStorage\\.setItem\\(FIXED_CAT_STORAGE_KEY, JSON\\.stringify\\(Array\\.from\\(appState\\.fixedCategories\\)\\)\\);\\s*\\}', """  async function saveFixedCategories() {
    await supabase.from('app_settings').upsert({ key: 'fixed_categories', value: Array.from(appState.fixedCategories) });
  }""", js)

# For deleted signatures saving
js = re.sub(r"localStorage\\.setItem\\('daily_deleted_sigs_v1', JSON\\.stringify\\(Array\\.from\\(appState\\.deletedSignatures\\)\\)\\);", "saveDeletedSignatures();", js)

if "async function saveDeletedSignatures" not in js:
    js = js.replace("async function saveData() {", """
  async function saveDeletedSignatures() {
    await supabase.from('app_settings').upsert({ key: 'deleted_signatures', value: Array.from(appState.deletedSignatures) });
  }
  async function saveData() {""")

# Replace loadData entirely using a smart split
start_idx = js.find("async function loadData()")
end_idx = js.find("function renderKPIs()", start_idx)

if start_idx != -1 and end_idx != -1:
    new_loadData = """async function loadData() {
    console.log("Loading data from Supabase...");
    try {
      // 1. Load Settings
      const { data: settings, error: setErr } = await supabase.from('app_settings').select('*');
      if (settings) {
        settings.forEach(s => {
          if (s.key === 'rules') appState.categoryRules = s.value;
          if (s.key === 'master_categories') appState.masterCategories = s.value;
          if (s.key === 'fixed_categories') appState.fixedCategories = new Set(s.value);
          if (s.key === 'deleted_signatures') appState.deletedSignatures = new Set(s.value);
          if (s.key === 'notification_logs') appState.notificationLogs = s.value;
          if (s.key === 'card_config') CARD_CONFIG = s.value;
        });
      }

      if (Object.keys(appState.masterCategories).length === 0) {
        appState.masterCategories = JSON.parse(JSON.stringify(DEFAULT_MASTER_CATEGORIES));
      }

      // 2. Load Records
      const { data: records, error: recErr } = await supabase.from('records').select('*').order('id', { ascending: true });
      
      if (records && records.length > 0) {
        appState.records = records;
        let changed = autoFlagInstallments();
        appState.records.forEach(r => {
          if (r.isFixed === undefined || r.isFixed === null) {
            checkFixedCategory(r);
            changed = true;
          }
        });
        if (changed) saveData();
      }

    } catch (err) {
      console.error("Supabase load error:", err);
    }
    
    if (!appState.records || appState.records.length === 0) {
      if (window.INITIAL_DATA && window.INITIAL_DATA.records && window.INITIAL_DATA.records.length > 0) {
        appState.records = [...window.INITIAL_DATA.records];
        saveData();
      }
    }
  }

  """
    js = js[:start_idx] + new_loadData + js[end_idx:]

# Handle Deletions (app.js uses filter for delete, we need to add supabase.delete)
# 1. btn-delete-row
js = js.replace("appState.records = appState.records.filter(r => r.id !== id);", "appState.records = appState.records.filter(r => r.id !== id);\\n      supabase.from('records').delete().eq('id', id).then();")

# 2. Reset Data
js = js.replace("appState.records = [];", "appState.records = [];\\n      supabase.from('records').delete().neq('id', 0).then();")

# Handle applyExcelData
js = js.replace("function applyExcelData(isAppend) {", "async function applyExcelData(isAppend) {")
js = js.replace("pendingUploadedRecords.forEach(r => checkFixedCategory(r));\\n      appState.records = [...pendingUploadedRecords];", "pendingUploadedRecords.forEach(r => checkFixedCategory(r));\\n      await supabase.from('records').delete().neq('id', 0);\\n      appState.records = [...pendingUploadedRecords];")
# Wait, applying excel data calls saveData() which will upsert the new ones!

# Save updated js
with open(js_path, "w", encoding="utf-8") as f:
    f.write(js)

print("Supabase integrated.")
''')
