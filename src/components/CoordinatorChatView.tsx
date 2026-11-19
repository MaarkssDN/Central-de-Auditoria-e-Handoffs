import { useEffect, useRef, useState } from 'react';
import { Bot, Send, User } from 'lucide-react';
import { MarkdownMessage } from './MarkdownMessage';
import type { WorkspaceState } from '../types/governance';

// Chat boot — fala com o Coordenador (agente 00) ou despacha direto para
// um provider de IA externo (Conexões de IA). Providers sem credencial
// respondem em modo mock, como no restante da Central.

interface ChatMsg { id: string; role: 'user' | 'assistant'; content: string; agent?: string }

interface ProviderOption { def: { id: string; nome: string }; status: string }

const COORDINATOR = { id: '00', nome: 'Coordenador (00)' };

export function CoordinatorChatView() {
  const [target, setTarget] = useState<string>('coordenador');
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'welcome',
      role: 'assistant',
      agent: '00',
      content:
        'Chat boot online. Fale comigo em linguagem natural — posso consultar handoffs, status de ondas e despachar agentes.\n\n' +
        'Para acionar uma ferramenta externa diretamente, troque o alvo no seletor acima (Codex, Claude, ChatGPT, Gemini, Antigravity, Devin, Copilot, Grok).',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/workspace')
      .then((r) => (r.ok ? r.json() : null))
      .then((w) => setWorkspace(w))
      .catch(() => {});
    fetch('/api/providers')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setProviders(((d as { providers?: ProviderOption[] })?.providers) || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      if (target === 'coordenador') {
        const res = await fetch('/api/agents/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: '00', prompt: text, workspace }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          replyMessage?: { content?: string };
          error?: string;
        };
        const reply =
          data.replyMessage?.content ||
          data.error ||
          'Sem resposta do coordenador.';
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', agent: '00', content: reply },
        ]);
      } else {
        const res = await fetch('/api/providers/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId: target, prompt: text }),
        });
        const data = (await res.json().catch(() => ({}))) as { output?: string; error?: string; mode?: string };
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            agent: target,
            content: data.output || data.error || 'Sem resposta.',
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', agent: 'erro', content: 'Falha de rede ao contatar o servidor.' },
      ]);
    } finally {
      setSending(false);
    }
  }

  const targetLabel =
    target === 'coordenador'
      ? COORDINATOR.nome
      : providers.find((p) => p.def.id === target)?.def.nome || target;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] rise-in">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-display text-xl font-bold text-paper-100">Chat Boot — Coordenador</h2>
          <p className="text-xs text-paper-400 mt-0.5">Alvo atual: {targetLabel}</p>
        </div>
        <select className="input text-xs" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="coordenador">{COORDINATOR.nome}</option>
          {providers.map((p) => (
            <option key={p.def.id} value={p.def.id}>
              {p.def.nome} [{p.status}]
            </option>
          ))}
        </select>
      </div>

      <div className="panel panel-corner flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg border border-signal-500/40 bg-ink-800 grid place-items-center shrink-0">
                  <Bot className="w-4 h-4 text-signal-400" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-signal-500/15 border border-signal-500/30 text-paper-100'
                    : 'bg-ink-800/70 border border-ink-700 text-paper-200'
                }`}
              >
                {m.role === 'assistant' && m.agent && m.agent !== '00' && (
                  <div className="font-mono text-[9px] uppercase tracking-wider text-signal-400 mb-1">{m.agent}</div>
                )}
                {m.role === 'assistant' ? <MarkdownMessage content={m.content} /> : m.content}
              </div>
              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-lg border border-ink-600 bg-ink-800 grid place-items-center shrink-0">
                  <User className="w-4 h-4 text-paper-300" />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg border border-signal-500/40 bg-ink-800 grid place-items-center">
                <Bot className="w-4 h-4 text-signal-400 animate-pulse" />
              </div>
              <div className="bg-ink-800/70 border border-ink-700 rounded-lg px-3.5 py-2.5">
                <span className="font-mono text-xs text-paper-400">processando…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-ink-700 p-3 flex gap-2">
          <input
            className="input flex-1"
            placeholder={target === 'coordenador' ? 'Fale com o coordenador…' : `Mensagem para ${targetLabel}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            disabled={sending}
          />
          <button type="button" className="btn btn-primary" onClick={send} disabled={sending || !input.trim()}>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
