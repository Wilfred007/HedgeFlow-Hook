'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED = [
  'What risk mode should I wait for before adding liquidity?',
  'How does HedgeFlow IL protection work?',
  'What happens to my fees during CRISIS mode?',
  'How do I minimize impermanent loss on volatile pairs?',
  'When should I remove my liquidity position?',
  'What does high whale activity mean for LPs?',
];

export default function ChatPage() {
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState('');
  const [streaming, setStreaming]   = useState(false);
  const bottomRef                   = useRef<HTMLDivElement>(null);
  const inputRef                    = useRef<HTMLTextAreaElement>(null);
  const abortRef                    = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setStreaming(true);

    // Placeholder for assistant reply that we'll stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.text();
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: `Error: ${err}` };
          return copy;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const chunk = JSON.parse(data);
            const delta = chunk.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                  role: 'assistant',
                  content: copy[copy.length - 1].content + delta,
                };
                return copy;
              });
            }
          } catch {
            // malformed chunk — skip
          }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: 'Connection failed. Make sure the app is running.' };
        return copy;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [messages, streaming]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const empty = messages.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', maxWidth: '800px', margin: '0 auto' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ padding: '28px 0 20px', flexShrink: 0 }}>
        <div className="section-label" style={{ marginBottom: '6px' }}>Powered by HedgeFlow AI</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          LP Advisor
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.875rem' }}>
          Ask anything about liquidity provision, risk modes, and IL protection
        </p>
      </div>

      {/* ── Messages ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Empty state — suggested questions */}
        {empty && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingTop: '16px' }}>
            {/* Welcome card */}
            <div
              className="glass-card"
              style={{
                borderRadius: '16px', padding: '28px 24px',
                background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(79,70,229,0.05))',
                border: '1px solid rgba(124,58,237,0.25)',
                position: 'relative', overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #7c3aed, #a855f7, transparent)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: '0 0 16px rgba(124,58,237,0.5)' }}>
                  ⬡
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>HedgeFlow LP Advisor</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>HedgeFlow AI · DeFi liquidity specialist</div>
                </div>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                I can help you navigate HedgeFlow&apos;s risk modes, understand your impermanent loss exposure, and decide when to enter or exit positions. What would you like to know?
              </p>
            </div>

            {/* Suggested questions */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                Suggested questions
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                {SUGGESTED.map(q => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    disabled={streaming}
                    style={{
                      textAlign: 'left', padding: '14px 16px',
                      background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
                      borderRadius: '12px', cursor: 'pointer', color: 'var(--text-secondary)',
                      fontSize: '0.8rem', lineHeight: 1.4, transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.4)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                      (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.06)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                      (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.3)';
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              gap: '12px',
              alignItems: 'flex-start',
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px',
                background: msg.role === 'user'
                  ? 'rgba(34,211,238,0.1)'
                  : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                border: msg.role === 'user'
                  ? '1px solid rgba(34,211,238,0.25)'
                  : 'none',
                boxShadow: msg.role === 'assistant' ? '0 0 12px rgba(124,58,237,0.4)' : 'none',
              }}
            >
              {msg.role === 'user' ? '👤' : '⬡'}
            </div>

            {/* Bubble */}
            <div
              style={{
                maxWidth: '80%',
                padding: '14px 18px',
                borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                background: msg.role === 'user'
                  ? 'rgba(34,211,238,0.08)'
                  : 'rgba(15,15,30,0.9)',
                border: msg.role === 'user'
                  ? '1px solid rgba(34,211,238,0.2)'
                  : '1px solid var(--border)',
                fontSize: '0.875rem',
                lineHeight: 1.65,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {msg.content}
              {/* Blinking cursor while streaming the last assistant message */}
              {streaming && i === messages.length - 1 && msg.role === 'assistant' && (
                <span
                  style={{
                    display: 'inline-block', width: '2px', height: '14px',
                    background: '#a855f7', marginLeft: '2px', verticalAlign: 'middle',
                    animation: 'glow-pulse 0.8s ease-in-out infinite',
                  }}
                />
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ──────────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0, paddingTop: '12px', paddingBottom: '20px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            display: 'flex', gap: '10px', alignItems: 'flex-end',
            background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)',
            borderRadius: '14px', padding: '10px 12px',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onFocusCapture={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.5)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(124,58,237,0.12)';
          }}
          onBlurCapture={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about liquidity strategies, risk modes, IL protection…"
            disabled={streaming}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: 1.5,
              resize: 'none', fontFamily: 'var(--font-sans)',
              maxHeight: '160px', overflowY: 'auto',
            }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            style={{
              width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
              background: input.trim() && !streaming ? 'var(--gradient-accent)' : 'var(--border)',
              border: 'none', cursor: input.trim() && !streaming ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: input.trim() && !streaming ? '0 0 12px rgba(124,58,237,0.4)' : 'none',
              fontSize: '16px',
            }}
            aria-label="Send"
          >
            {streaming ? (
              <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'block', animation: 'spin-slow 0.7s linear infinite' }} />
            ) : (
              '↑'
            )}
          </button>
        </div>
        <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          Enter to send · Shift+Enter for new line · Powered by HedgeFlow AI
        </div>
      </div>
    </div>
  );
}
