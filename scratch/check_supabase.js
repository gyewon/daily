const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const urlMatch = html.match(/supabaseUrl\s*=\s*['"`](.*?)['"`]/);
const keyMatch = html.match(/supabaseKey\s*=\s*['"`](.*?)['"`]/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const { data, error } = await supabase.from('records').select('*');
  if (error) {
    console.error(error);
    return;
  }
  const match = data.filter(r => String(r.merchant).includes('Airbnb') || String(r.amount) === '813074');
  console.log('Matches:', match.length);
  if (match.length) {
    console.log(match[0]);
  }
}
run();
