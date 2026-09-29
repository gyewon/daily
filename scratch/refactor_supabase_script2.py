import os
import re

js_path = "d:/AI App/daily/app.js"
with open(js_path, "r", encoding="utf-8") as f:
    js = f.read()

supabase_init = """
const supabaseUrl = 'https://jkuuwmuniuvijvbtvwde.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
"""
if "supabaseUrl" not in js:
    js = js.replace("const CARD_STORAGE_KEY = 'gyewon_card_config_v1';", "const CARD_STORAGE_KEY = 'gyewon_card_config_v1';\n" + supabase_init)

# saveData
new_saveData = """
  async function saveData() {
    if (appState.records.length > 0) {
      const { error } = await supabase.from('records').upsert(appState.records);
      if (error) console.error("Supabase Save Error (records):", error);
    }
  }
"""
js = re.sub(r'function saveData\(\) \{[\s\S]*?localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(appState\.records\)\);\s*\}', new_saveData, js)

# saveRules
new_saveRules = """
  async function saveRules() {
    await supabase.from('app_settings').upsert({ key: 'rules', value: appState.categoryRules });
  }
"""
js = re.sub(r'function saveRules\(\) \{[\s\S]*?localStorage\.setItem\(RULES_STORAGE_KEY, JSON\.stringify\(appState\.categoryRules\)\);\s*\}', new_saveRules, js)

# saveMasterCategories
new_saveMaster = """
  async function saveMasterCategories() {
    await supabase.from('app_settings').upsert({ key: 'master_categories', value: appState.masterCategories });
  }
"""
js = re.sub(r'function saveMasterCategories\(\) \{[\s\S]*?localStorage\.setItem\(MASTER_CAT_STORAGE_KEY, JSON\.stringify\(appState\.masterCategories\)\);\s*\}', new_saveMaster, js)

# saveFixedCategories
new_saveFixed = """
  async function saveFixedCategories() {
    await supabase.from('app_settings').upsert({ key: 'fixed_categories', value: Array.from(appState.fixedCategories) });
  }
"""
js = re.sub(r'function saveFixedCategories\(\) \{[\s\S]*?localStorage\.setItem\(FIXED_CAT_STORAGE_KEY, JSON\.stringify\(Array\.from\(appState\.fixedCategories\)\)\);\s*\}', new_saveFixed, js)

# saveDeletedSignatures
new_saveDeleted = """
  async function saveDeletedSignatures() {
    await supabase.from('app_settings').upsert({ key: 'deleted_signatures', value: Array.from(appState.deletedSignatures) });
  }
"""
js = re.sub(r"localStorage\.setItem\('daily_deleted_sigs_v1', JSON\.stringify\(Array\.from\(appState\.deletedSignatures\)\)\);", "saveDeletedSignatures();", js)
if "async function saveDeletedSignatures" not in js:
    js = js.replace("async function saveData() {", new_saveDeleted + "\nasync function saveData() {")

# Replace loadData
start_idx = js.find("async function loadData()")
end_idx = js.find("function renderKPIs()", start_idx)

if start_idx != -1 and end_idx != -1:
    new_loadData = """async function loadData() {
    console.log("Loading data from Supabase...");
    try {
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
        appState.records = JSON.parse(JSON.stringify(window.INITIAL_DATA.records));
        saveData();
      }
    }
  }

  // Define checkFixedCategory so we don't accidentally remove it if it was between loadData and renderKPIs.
  // Wait, I shouldn't overwrite checkFixedCategory. 
  // Let me just replace the exact block of loadData!
"""

# Let's write a precise regex for loadData instead of splitting
loadData_pattern = r'async function loadData\(\) \{[\s\S]*?\}\s+if \(\!appState\.records \|\| appState\.records\.length === 0\) \{[\s\S]*?saveData\(\);\s*\}\s*\}\s*\}'
js = re.sub(loadData_pattern, new_loadData.strip() + '\n', js)

# Deletions: btn-delete-row
js = js.replace("appState.records = appState.records.filter(r => r.id !== id);", "appState.records = appState.records.filter(r => r.id !== id);\n      supabase.from('records').delete().eq('id', id).then();")

# Deletions: Reset Data
js = js.replace("appState.records = [];", "appState.records = [];\n      supabase.from('records').delete().neq('id', 0).then();")

# Apply Excel Data
js = js.replace("function applyExcelData(isAppend) {", "async function applyExcelData(isAppend) {")
js = js.replace("appState.records = [...pendingUploadedRecords];", "await supabase.from('records').delete().neq('id', 0);\n      appState.records = [...pendingUploadedRecords];")

with open(js_path, "w", encoding="utf-8") as f:
    f.write(js)

print("Python refactor executed.")
