import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, MessageSquare, X } from 'lucide-react';
import { CoordinatorChatView } from './CoordinatorChatView';

interface SpeechRecognitionResultItem { transcript: string }
interface SpeechRecognitionResultList { [index: number]: SpeechRecognitionResultItem; length: number }
interface SpeechRecognitionEventLike { results: SpeechRecognitionResultList }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const OPEN_COMMANDS = ['abrir chat', 'abrir coordenador', 'abrir chat boot', 'coordenador', 'chat boot'];
const CLOSE_COMMANDS = ['fechar chat', 'fechar coordenador', 'encerrar chat'];

function matchesCommand(transcript: string, commands: string[]): boolean {
  const t = transcript.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return commands.some((c) => t.includes(c));
}

export function ChatBootWidget() {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    setVoiceSupported(getSpeechRecognition() !== null);
  }, []);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'pt-BR';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = e.results[e.results.length - 1]?.transcript || '';
      if (matchesCommand(text, OPEN_COMMANDS)) setOpen(true);
      else if (matchesCommand(text, CLOSE_COMMANDS)) setOpen(false);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch { /* já está rodando */ }
  }, []);

  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch { /* noop */ } }, []);

  return (
    <>
      {/* Painel flutuante do coordenador */}
      {open && (
        <div className="fixed bottom-24 right-5 z-40 w-[min(420px,calc(100vw-2.5rem))] h-[min(560px,calc(100vh-8rem))] panel rounded-2xl overflow-hidden flex flex-col shadow-2xl">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-ink-700/60 bg-ink-900/80">
            <span className="w-2 h-2 rounded-full bg-ok-400 animate-pulse" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-bold text-accent-blue">Chat Boot</p>
              <p className="text-[10px] font-mono text-accent-blue/70 uppercase tracking-wider">Coordenador de agentes</p>
            </div>
            {voiceSupported && (
              <button
                type="button"
                onClick={() => (listening ? stopListening() : startListening())}
                aria-label={listening ? 'Desligar comando de voz' : 'Ligar comando de voz'}
                className={`p-2 rounded-xl transition-colors ${
                  listening ? 'bg-alert-500/20 text-alert-400' : 'text-paper-300 hover:text-paper-100 hover:bg-ink-800/60'
                }`}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar chat"
              className="p-2 rounded-xl text-paper-300 hover:text-paper-100 hover:bg-ink-800/60"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <CoordinatorChatView />
          </div>
        </div>
      )}

      {/* Botão flutuante */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        {voiceSupported && listening && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-alert-400 bg-ink-900/90 border border-alert-500/40 rounded-full px-3 py-1">
            Ouvindo… diga "abrir chat" ou "fechar chat"
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fechar Chat Boot' : 'Abrir Chat Boot'}
          className="w-14 h-14 rounded-2xl grid place-items-center shadow-2xl transition-transform hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #2563EB, #1d4ed8)',
            border: '1px solid rgba(96,165,250,0.5)',
            color: '#fff',
          }}
        >
          {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </button>
      </div>
    </>
  );
}
