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

def replace_func(func_name, new_code, source):
    # Matches `function funcName() { ... }` where it might have a try/catch block
    pattern = rf'function {func_name}\(\)\s*\{{.*?(?=\n\s*function|\n\s*const|\n\s*let|\Z)'
    # Actually, a simpler way is just replacing the exact strings since I have the source
    return source

# Let's just use simple text replacement for the whole functions
saveData_old = """  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.records));
      saveDeletedSignatures();
      localStorage.setItem('daily_notification_logs_v1', JSON.stringify(appState.notificationLogs));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }"""
saveData_new = """  async function saveData() {
    try {
      if (appState.records.length > 0) {
        const { error } = await supabase.from('records').upsert(appState.records);
        if (error) console.error("Supabase Save Error (records):", error);
      }
      saveDeletedSignatures();
      await supabase.from('app_settings').upsert({ key: 'notification_logs', value: appState.notificationLogs });
    } catch (e) {
      console.error('Failed to save to Supabase:', e);
    }
  }"""
js = js.replace(saveData_old, saveData_new)

saveRules_old = """  function saveRules() {
    try {
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(appState.categoryRules));
    } catch (e) {
      console.error('Failed to save rules to localStorage:', e);
    }
  }"""
saveRules_new = """  async function saveRules() {
    await supabase.from('app_settings').upsert({ key: 'rules', value: appState.categoryRules });
  }"""
js = js.replace(saveRules_old, saveRules_new)

saveMaster_old = """  function saveMasterCategories() {
    try {
      localStorage.setItem(MASTER_CAT_STORAGE_KEY, JSON.stringify(appState.masterCategories));
    } catch (e) {
      console.error('Failed to save master categories to localStorage:', e);
    }
  }"""
saveMaster_new = """  async function saveMasterCategories() {
    await supabase.from('app_settings').upsert({ key: 'master_categories', value: appState.masterCategories });
  }"""
js = js.replace(saveMaster_old, saveMaster_new)

saveFixed_old = """  function saveFixedCategories() {
    try {
      localStorage.setItem(FIXED_CAT_STORAGE_KEY, JSON.stringify(Array.from(appState.fixedCategories)));
    } catch (e) {
      console.error('Failed to save fixed categories to localStorage:', e);
    }
  }"""
saveFixed_new = """  async function saveFixedCategories() {
    await supabase.from('app_settings').upsert({ key: 'fixed_categories', value: Array.from(appState.fixedCategories) });
  }"""
js = js.replace(saveFixed_old, saveFixed_new)

# deleted signatures was inline inside saveData
new_saveDeleted = """  async function saveDeletedSignatures() {
    await supabase.from('app_settings').upsert({ key: 'deleted_signatures', value: Array.from(appState.deletedSignatures) });
  }"""
if "async function saveDeletedSignatures" not in js:
    js = js.replace("async function saveData() {", new_saveDeleted + "\n\n  async function saveData() {")

# loadData replacement
loadData_old_start = "async function loadData() {"
loadData_old_end = "if (window.INITIAL_DATA && window.INITIAL_DATA.records && window.INITIAL_DATA.records.length > 0) {\n        appState.records = [...window.INITIAL_DATA.records];\n        saveData();\n      }\n    }\n  }"

loadData_new = """async function loadData() {
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
  }"""

start_idx = js.find(loadData_old_start)
end_idx = js.find(loadData_old_end, start_idx) + len(loadData_old_end)
if start_idx != -1 and end_idx != -1 + len(loadData_old_end):
    js = js[:start_idx] + loadData_new + js[end_idx:]

# Deletions: btn-delete-row
js = js.replace("appState.records = appState.records.filter(r => r.id !== id);", "appState.records = appState.records.filter(r => r.id !== id);\n      supabase.from('records').delete().eq('id', id).then();")

# Deletions: Reset Data
js = js.replace("appState.records = [];", "appState.records = [];\n      supabase.from('records').delete().neq('id', 0).then();")

# Apply Excel Data
js = js.replace("function applyExcelData(isAppend) {", "async function applyExcelData(isAppend) {")
js = js.replace("appState.records = [...pendingUploadedRecords];", "await supabase.from('records').delete().neq('id', 0);\n      appState.records = [...pendingUploadedRecords];")

with open(js_path, "w", encoding="utf-8") as f:
    f.write(js)

print("Refactor complete.")
