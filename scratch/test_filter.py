import sys, os
sys.path.insert(0, os.path.abspath('.'))
import banksalad_sync

s = banksalad_sync.get_supabase_app_settings()
records = s.get('records', [])
custom_types = s.get('custom_types', {})
card_config = s.get('card_config', {})

app_state = {
    'globalMonth': '10월',
    'filterCard': 'ALL',
    'filterCategory': 'ALL',
    'chartExcludedCategories': set(),
    'filterType': '리뷰비',
    'customTypes': custom_types,
    'filterExclude': 'ALL',
    'filterInstallment': 'ALL',
    'searchQuery': ''
}

def test_filter(r, state):
    # 1. month
    if state['globalMonth'] != 'ALL' and r.get('month') != state['globalMonth']:
        return False, "month mismatch"
    
    # 2. card
    if state['filterCard'] != 'ALL':
        if r.get('actualCard') != state['filterCard']:
            return False, "card mismatch"
            
    # 3. category
    if state['filterCategory'] != 'ALL':
        if r.get('category') != state['filterCategory']:
            return False, "category mismatch"
    elif state['chartExcludedCategories'] and r.get('category') in state['chartExcludedCategories']:
        return False, "chart excluded"
        
    # 4. type
    ft = state['filterType']
    if ft and ft != 'ALL':
        type_cats = state['customTypes'].get(ft, [])
        if ft == '변동비':
            pass
        else:
            if r.get('category') not in type_cats and r.get('category') != ft and not (ft == '고정비' and r.get('isFixed') == 'Y'):
                return False, f"type mismatch (not in {type_cats} and != {ft})"
                
    # 5. exclude
    if state['filterExclude'] != 'ALL':
        if r.get('exclude') != state['filterExclude']:
            return False, "exclude mismatch"
            
    # 6. installment
    if state['filterInstallment'] in ('N', '일시불') and r.get('isInstallment') == 'Y':
        return False, "installment mismatch"
        
    return True, "OK"

for r in records:
    if r.get('id') in (132, 159):
        ok, reason = test_filter(r, app_state)
        print(f"ID {r.get('id')}: ok={ok}, reason={reason}")
