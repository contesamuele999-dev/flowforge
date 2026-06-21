// storage.js - Persistenza su Supabase (per deploy online)
// Variabili d'ambiente richieste: SUPABASE_URL, SUPABASE_KEY
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const MAX_EXECUTIONS = 200;

// ---- Workflows ----
async function getWorkflows() {
  const { data, error } = await supabase.from('workflows').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(row => row.data);
}

async function getWorkflow(id) {
  const { data, error } = await supabase.from('workflows').select('data').eq('id', id).single();
  if (error || !data) return null;
  return data.data;
}

async function saveWorkflow(workflow) {
  workflow.updatedAt = new Date().toISOString();
  if (!workflow.createdAt) workflow.createdAt = workflow.updatedAt;
  const { error } = await supabase.from('workflows').upsert({
    id: workflow.id,
    data: workflow,
    created_at: workflow.createdAt,
    updated_at: workflow.updatedAt,
  });
  if (error) throw new Error(error.message);
  return workflow;
}

async function deleteWorkflow(id) {
  const { error } = await supabase.from('workflows').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---- Executions ----
async function getExecutions(workflowId) {
  let query = supabase.from('executions').select('data').order('started_at', { ascending: false }).limit(MAX_EXECUTIONS);
  if (workflowId) query = query.eq('workflow_id', workflowId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map(row => row.data);
}

async function getExecution(id) {
  const { data, error } = await supabase.from('executions').select('data').eq('id', id).single();
  if (error || !data) return null;
  return data.data;
}

async function saveExecution(execution) {
  const { error } = await supabase.from('executions').upsert({
    id: execution.id,
    workflow_id: execution.workflowId,
    started_at: execution.startedAt,
    status: execution.status,
    data: execution,
  });
  if (error) throw new Error(error.message);
  return execution;
}

// ---- Variabili globali ----
async function getVars() {
  const { data, error } = await supabase.from('vars').select('key, value');
  if (error) throw new Error(error.message);
  const result = {};
  for (const row of data || []) result[row.key] = row.value;
  return result;
}

async function saveVars(vars) {
  const clean = {};
  for (const [k, v] of Object.entries(vars || {})) {
    if (k && String(k).trim()) clean[String(k).trim()] = String(v ?? '');
  }
  // Cancella tutto e reinserisci (semplice per pochi record)
  await supabase.from('vars').delete().neq('key', '__placeholder__');
  const rows = Object.entries(clean).map(([key, value]) => ({ key, value }));
  if (rows.length > 0) {
    const { error } = await supabase.from('vars').insert(rows);
    if (error) throw new Error(error.message);
  }
  return clean;
}

module.exports = {
  getWorkflows, getWorkflow, saveWorkflow, deleteWorkflow,
  getExecutions, getExecution, saveExecution,
  getVars, saveVars,
};
