// storage.js - Persistenza su Supabase (per deploy online)
// Variabili d'ambiente richieste: SUPABASE_URL, SUPABASE_KEY (usa la SERVICE_ROLE key)
//
// IMPORTANTE: ogni risorsa (workflow, esecuzione, variabile) è legata a un user_id.
// Tutte le funzioni che operano su dati utente RICHIEDONO userId e filtrano per esso:
// è qui che vive l'isolamento reale tra utenti. L'RLS su Supabase è solo difesa secondaria.
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const MAX_EXECUTIONS = 200;

function requireUser(userId) {
  if (!userId) throw new Error('userId mancante: operazione non consentita');
  return userId;
}

// ================= UTENTI =================
async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users').select('*').ilike('email', email).limit(1);
  if (error) throw new Error(error.message);
  return (data && data[0]) || null;
}

async function getUserById(id) {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data;
}

async function createUser(user) {
  const now = new Date().toISOString();
  const { error } = await supabase.from('users').insert({
    id: user.id,
    email: user.email,
    password_hash: user.password_hash,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
  return user;
}

async function updateUser(id, patch) {
  const { data, error } = await supabase.from('users')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

// ================= WORKFLOWS =================
async function getWorkflows(userId) {
  requireUser(userId);
  const { data, error } = await supabase
    .from('workflows').select('data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(row => row.data);
}

async function getWorkflow(id, userId) {
  requireUser(userId);
  const { data, error } = await supabase
    .from('workflows').select('data')
    .eq('id', id).eq('user_id', userId).single();
  if (error || !data) return null;
  return data.data;
}

async function saveWorkflow(workflow, userId) {
  requireUser(userId);
  workflow.updatedAt = new Date().toISOString();
  if (!workflow.createdAt) workflow.createdAt = workflow.updatedAt;
  const { error } = await supabase.from('workflows').upsert({
    id: workflow.id,
    user_id: userId,
    data: workflow,
    created_at: workflow.createdAt,
    updated_at: workflow.updatedAt,
  });
  if (error) throw new Error(error.message);
  return workflow;
}

async function deleteWorkflow(id, userId) {
  requireUser(userId);
  const { error } = await supabase.from('workflows')
    .delete().eq('id', id).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// Per scheduler e webhook: tutti i workflow attivi di TUTTI gli utenti,
// con il loro user_id (serve per eseguire nel contesto corretto del proprietario).
async function getAllActiveWorkflowsWithOwner() {
  const { data, error } = await supabase
    .from('workflows').select('user_id, data');
  if (error) throw new Error(error.message);
  return (data || [])
    .filter(row => row.data && row.data.active)
    .map(row => ({ userId: row.user_id, workflow: row.data }));
}

// ================= EXECUTIONS =================
async function getExecutions(workflowId, userId) {
  requireUser(userId);
  let query = supabase.from('executions').select('data')
    .eq('user_id', userId)
    .order('started_at', { ascending: false }).limit(MAX_EXECUTIONS);
  if (workflowId) query = query.eq('workflow_id', workflowId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map(row => row.data);
}

async function getExecution(id, userId) {
  requireUser(userId);
  const { data, error } = await supabase.from('executions').select('data')
    .eq('id', id).eq('user_id', userId).single();
  if (error || !data) return null;
  return data.data;
}

async function saveExecution(execution, userId) {
  requireUser(userId);
  const { error } = await supabase.from('executions').upsert({
    id: execution.id,
    user_id: userId,
    workflow_id: execution.workflowId,
    started_at: execution.startedAt,
    status: execution.status,
    data: execution,
  });
  if (error) throw new Error(error.message);
  return execution;
}

// ================= VARIABILI (per-utente) =================
async function getVars(userId) {
  requireUser(userId);
  const { data, error } = await supabase
    .from('vars').select('key, value').eq('user_id', userId);
  if (error) throw new Error(error.message);
  const result = {};
  for (const row of data || []) result[row.key] = row.value;
  return result;
}

async function saveVars(vars, userId) {
  requireUser(userId);
  const clean = {};
  for (const [k, v] of Object.entries(vars || {})) {
    if (k && String(k).trim()) clean[String(k).trim()] = String(v ?? '');
  }
  // Cancella le var dell'utente e reinserisci
  await supabase.from('vars').delete().eq('user_id', userId);
  const rows = Object.entries(clean).map(([key, value]) => ({ key, value, user_id: userId }));
  if (rows.length > 0) {
    const { error } = await supabase.from('vars').insert(rows);
    if (error) throw new Error(error.message);
  }
  return clean;
}

module.exports = {
  // utenti
  getUserByEmail, getUserById, createUser, updateUser,
  // workflows
  getWorkflows, getWorkflow, saveWorkflow, deleteWorkflow, getAllActiveWorkflowsWithOwner,
  // executions
  getExecutions, getExecution, saveExecution,
  // vars
  getVars, saveVars,
};
