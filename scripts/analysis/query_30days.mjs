import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const st = await supabase.from('stores').select('id,name').eq('name','Ongles Charlesbourg').single();
  const store = st.data;
  if (!store) return console.log('Store not found');
  const d = new Date(); d.setDate(d.getDate() - 30);
  const dateFilter = d.toISOString().split('T')[0];
  const res = await supabase.from('cash_transactions').select('id,date,transaction_type,amount,category,description,status,created_at,created_by:employees!cash_transactions_created_by_id_fkey(display_name),approved_by:employees!cash_transactions_manager_approved_by_id_fkey(display_name)').eq('store_id',store.id).in('transaction_type',['cash_in','cash_out']).gte('date',dateFilter).order('date',{ascending:false}).order('created_at',{ascending:false});
  const txs = res.data || [];
  console.log('\n=== Ongles Charlesbourg Cash In/Out (Last 30 Days) ===\n');
  console.log('Date Range:',dateFilter,'to today, Total:',txs.length,'\n');
  if (txs.length === 0) return console.log('No transactions');
  const byDate = {}; txs.forEach(tx => { byDate[tx.date] = byDate[tx.date] || []; byDate[tx.date].push(tx); });
  Object.keys(byDate).sort().reverse().forEach(date => {
    console.log('\n📅',date,'\n'+'─'.repeat(80));
    byDate[date].forEach(tx => {
      const type = tx.transaction_type === 'cash_in' ? '💵 IN ' : '💸 OUT';
      const st = tx.status === 'approved' ? '✅' : tx.status === 'pending_approval' ? '⏳' : '❌';
      console.log(type,'| $'+tx.amount.toFixed(2).padStart(8),'|',tx.category.padEnd(20),'|',st,tx.status);
      console.log('     Desc:',tx.description || 'N/A');
      console.log('     By:',tx.created_by?.display_name || 'Unknown');
      if (tx.approved_by?.display_name) console.log('     Approved:',tx.approved_by.display_name);
      console.log('');
    });
  });
  const cashIn = txs.filter(t => t.transaction_type === 'cash_in');
  const cashOut = txs.filter(t => t.transaction_type === 'cash_out');
  const totalIn = cashIn.reduce((s,t) => s + parseFloat(t.amount), 0);
  const totalOut = cashOut.reduce((s,t) => s + parseFloat(t.amount), 0);
  console.log('\n'+'='.repeat(80),'\n📊 SUMMARY\n'+'='.repeat(80));
  console.log('Cash In: ',cashIn.length,'txs, Total: $'+totalIn.toFixed(2));
  console.log('Cash Out:',cashOut.length,'txs, Total: $'+totalOut.toFixed(2));
  console.log('Net Flow: $'+(totalIn-totalOut).toFixed(2));
  console.log('='.repeat(80));
}
run().catch(console.error);