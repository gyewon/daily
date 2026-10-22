import os
import glob
import openpyxl
import datetime
import sys

sys.stdout.reconfigure(encoding='utf-8')

candidates = []
for p in [
    'd:/AI App/daily/scratch/extracted_excel/*.xlsx',
    'C:/Users/js011/Downloads/*.xlsx',
    'd:/AI App/daily/*.xlsx'
]:
    for f in glob.glob(p):
        candidates.append(f)

for f in candidates:
    try:
        wb = openpyxl.load_workbook(f, data_only=True)
        sheet = None
        if '가계부 내역' in wb.sheetnames:
            sheet = wb['가계부 내역']
        elif len(wb.sheetnames) > 0:
            sheet = wb.active
        
        if not sheet:
            continue
            
        rows = list(sheet.iter_rows(values_only=True))
        if len(rows) < 2:
            continue
            
        # check if it looks like banksalad
        header = [str(c or '') for c in rows[0]]
        expenses = []
        for r in rows[1:]:
            if len(r) > 2 and str(r[2] or '').strip() == '지출':
                expenses.append(r)
                
        # print info if expenses count is between 60 and 100
        if 70 <= len(expenses) <= 90:
            mtime = datetime.datetime.fromtimestamp(os.path.getmtime(f))
            print(f"File: {f} | mtime: {mtime} | total rows: {len(rows)} | expenses: {len(expenses)}")
    except Exception as e:
        pass
