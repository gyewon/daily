import os
import re

js_path = "d:/AI App/daily/app.js"
with open(js_path, "r", encoding="utf-8") as f:
    js = f.read()

# 1. Inject Supabase
supabase_init = """
const supabaseUrl = 'https://jkuuwmuniuvijvbtvwde.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
"""
if "supabaseUrl" not in js:
    js = js.replace("const CARD_STORAGE_KEY = 'gyewon_card_config_v1';", "const CARD_STORAGE_KEY = 'gyewon_card_config_v1';\n" + supabase_init)

# 2. Add async function saveCardConfig()
saveCard_new = """
  async function saveCardConfig() {
    await supabase.from('app_settings').upsert({ key: 'card_config', value: CARD_CONFIG });
  }
"""
if "async function saveCardConfig" not in js:
    js = js.replace("async function saveData() {", saveCard_new + "\n  async function saveData() {")

# 3. Replace all localStorage.setItem(CARD_STORAGE_KEY, ...) with saveCardConfig();
js = re.sub(r'localStorage\.setItem\(CARD_STORAGE_KEY,\s*JSON\.stringify\(CARD_CONFIG\)\);?', 'saveCardConfig();', js)

# 4. Replace loadData entirely using regex
loadData_pattern = r'async function loadData\(\) \{[\s\S]*?\}\s+if \(\!appState\.records \|\| appState\.records\.length === 0\) \{[\s\S]*?\}\s*\}\s*\}'

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
  }"""

js = re.sub(loadData_pattern, new_loadData, js)

with open(js_path, "w", encoding="utf-8") as f:
    f.write(js)

print("Card Config and loadData refactor executed.")
