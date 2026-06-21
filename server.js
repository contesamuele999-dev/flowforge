// server.js - FlowForge: clone semplificato di n8n
const express = require('express');
const path = require('path');
const storage = require('./storage');
const { executeWorkflow, executeSingleNode } = require('./engine');

const app = express();
const PORT = process.env.PORT || 5678;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- API Workflows ----
app.get('/api/workflows', async (req, res) => {
  try {
    const workflows = await storage.getWorkflows();
    res.json(workflows.map(w => ({
      id: w.id, name: w.name, active: w.active,
      nodeCount: (w.nodes || []).length,
      updatedAt: w.updatedAt, createdAt: w.createdAt,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/workflows/:id', async (req, res) => {
  try {
    const w = await storage.getWorkflow(req.params.id);
    if (!w) return res.status(404).json({ error: 'Workflow non trovato' });
    res.json(w);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/workflows', async (req, res) => {
  try {
    const w = {
      id: 'wf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: req.body.name || 'Nuovo workflow',
      active: !!req.body.active,
      nodes: req.body.nodes || [],
      connections: req.body.connections || [],
    };
    await storage.saveWorkflow(w);
    res.json(w);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/workflows/:id', async (req, res) => {
  try {
    const existing = await storage.getWorkflow(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Workflow non trovato' });
    const w = { ...existing, ...req.body, id: existing.id, createdAt: existing.createdAt };
    await storage.saveWorkflow(w);
    res.json(w);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/workflows/:id', async (req, res) => {
  try {
    await storage.deleteWorkflow(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Variabili globali ----
app.get('/api/vars', async (req, res) => {
  try { res.json(await storage.getVars()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/vars', async (req, res) => {
  try { res.json(await storage.saveVars(req.body || {})); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Esecuzione manuale ----
app.post('/api/workflows/:id/execute', async (req, res) => {
  try {
    const w = await storage.getWorkflow(req.params.id);
    if (!w) return res.status(404).json({ error: 'Workflow non trovato' });
    const vars = await storage.getVars();
    let exec;
    if (req.body?.singleNodeId) {
      exec = await executeSingleNode(w, req.body.singleNodeId, req.body?.input, vars);
    } else {
      exec = await executeWorkflow(w, req.body?.data || {}, req.body?.triggerNodeId, vars);
    }
    await storage.saveExecution(exec);
    res.json(exec);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Esecuzioni ----
app.get('/api/executions', async (req, res) => {
  try {
    const list = (await storage.getExecutions(req.query.workflowId)).map(e => ({
      id: e.id, workflowId: e.workflowId, workflowName: e.workflowName,
      status: e.status, startedAt: e.startedAt, durationMs: e.durationMs, error: e.error,
    }));
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/executions/:id', async (req, res) => {
  try {
    const e = await storage.getExecution(req.params.id);
    if (!e) return res.status(404).json({ error: 'Esecuzione non trovata' });
    res.json(e);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Webhook trigger ----
app.all('/webhook/:path(*)', async (req, res) => {
  try {
    const hookPath = req.params.path;
    const workflows = (await storage.getWorkflows()).filter(w => w.active);
    const vars = await storage.getVars();
    for (const w of workflows) {
      const trigger = (w.nodes || []).find(n =>
        n.type === 'webhook' &&
        (n.parameters?.path || '').replace(/^\//, '') === hookPath &&
        (!n.parameters?.method || n.parameters.method === 'ANY' || n.parameters.method === req.method)
      );
      if (trigger) {
        const data = { body: req.body, query: req.query, headers: req.headers, method: req.method };
        const exec = await executeWorkflow(w, data, trigger.id, vars);
        await storage.saveExecution(exec);
        if (exec.status === 'error') return res.status(500).json({ error: exec.error, executionId: exec.id });
        return res.json({ executionId: exec.id, output: exec.lastOutput });
      }
    }
    res.status(404).json({ error: `Nessun workflow attivo con webhook "/${hookPath}"` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Scheduler ----
const lastRuns = new Map();
setInterval(async () => {
  const now = new Date();
  try {
    for (const w of await storage.getWorkflows()) {
      if (!w.active) continue;
      for (const node of (w.nodes || [])) {
        if (node.type !== 'schedule') continue;
        const key = w.id + ':' + node.id;
        const p = node.parameters || {};
        const last = lastRuns.get(key) || 0;
        let due = false;
        if (p.mode === 'everyMinutes') {
          const interval = Math.max(1, Number(p.minutes) || 5) * 60000;
          due = Date.now() - last >= interval;
        } else if (p.mode === 'everyHours') {
          const interval = Math.max(1, Number(p.hours) || 1) * 3600000;
          due = Date.now() - last >= interval;
        } else if (p.mode === 'dailyAt') {
          const [hh, mm] = String(p.time || '09:00').split(':').map(Number);
          const todayTarget = new Date(now); todayTarget.setHours(hh || 0, mm || 0, 0, 0);
          due = now >= todayTarget && last < todayTarget.getTime();
        }
        if (due) {
          lastRuns.set(key, Date.now());
          try {
            const vars = await storage.getVars();
            const exec = await executeWorkflow(w, {}, node.id, vars);
            await storage.saveExecution(exec);
            console.log(`[scheduler] ${w.name}: ${exec.status} (${exec.durationMs}ms)`);
          } catch (e) {
            console.error(`[scheduler] errore in ${w.name}:`, e.message);
          }
        }
      }
    }
  } catch (e) {
    console.error('[scheduler] errore lettura workflows:', e.message);
  }
}, 20000);

app.listen(PORT, () => {
  console.log(`\n  FlowForge avviato!`);
  console.log(`  Apri l'editor:  http://localhost:${PORT}`);
  console.log(`  Webhook base:   http://localhost:${PORT}/webhook/<path>\n`);
});
