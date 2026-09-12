import { useEffect, useRef, useState } from 'react';
import { usePondData } from '../context/pondDataStore';
import { chatWithAoi } from '../services/dataSource';

const QUICK_PROMPTS = [
  'What is happening?',
  'Why is my pond stressed?',
  'What should I do?',
  'Can I improve it further?',
  'Explain the carbon estimate',
];

export default function AoiAssistant() {
  const { activePondId, snapshot } = usePondData();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, busy]);
  useEffect(() => {
    const close = event => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  async function send(value) {
    const text = String(value || input).trim();
    if (!text || busy) return;
    setMessages(current => [...current, { role: 'user', text }]);
    setInput('');
    setBusy(true);
    try {
      const result = await chatWithAoi(activePondId, text);
      setMessages(current => [...current, {
        role: 'aoi',
        text: result.answer,
        provider: result.provider,
        action: result.recommended_action,
      }]);
    } catch (error) {
      setMessages(current => [...current, {
        role: 'aoi',
        text: error.status === 404
          ? 'I need the first live prediction before I can answer from the digital twin. Use Predict now or wait for the automatic cycle.'
          : `I could not reach the insight engine: ${error.message}`,
        provider: 'connection notice',
      }]);
    } finally {
      setBusy(false);
    }
  }

  const greeting = `${snapshot?.label || 'Current'} state loaded for ${activePondId}. Ask what the twin sees, or let me test a supported action.`;

  return <>
    <button className="aoi-launcher" onClick={() => setOpen(true)} aria-label="Open Aoi assistant" aria-expanded={open}>
      <img src="/images/aoi-mascot.png" alt=""/><i/><span>Ask Aoi</span>
    </button>
    <div className={`aoi-overlay ${open ? 'is-open' : ''}`} aria-hidden={!open} onMouseDown={event => event.target === event.currentTarget && setOpen(false)}>
      <section className="aoi-dialog" role="dialog" aria-modal="true" aria-label="Aoi digital twin assistant">
        <header>
          <div className="aoi-dialog-avatar"><img src="/images/aoi-mascot.png" alt="Aoi"/></div>
          <div><b>Aoi</b><span>Model-grounded pond guide</span><small><i/> Watching {activePondId}</small></div>
          <button onClick={() => setOpen(false)} aria-label="Close Aoi">x</button>
        </header>
        <div className="aoi-trust-strip"><span>Digital twin</span><span>Scenario search</span><span>Gemini-ready</span></div>
        <div className="aoi-quick-actions">{QUICK_PROMPTS.map(prompt => <button key={prompt} onClick={() => void send(prompt)}>{prompt}</button>)}</div>
        <div className="aoi-messages" aria-live="polite">
          <div className="aoi-message"><img src="/images/aoi-mascot.png" alt=""/><div><p>{greeting}</p><small className="aoi-provider">live twin context</small></div></div>
          {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`aoi-message ${message.role}`}>
            {message.role === 'user' ? <span className="aoi-user">YOU</span> : <img src="/images/aoi-mascot.png" alt=""/>}
            <div>
              <p>{message.text}</p>
              {message.action && <span className="aoi-action-proof"><span>Tested {Object.keys(message.action.changes).length} control(s)</span><span>Live state unchanged</span></span>}
              {message.provider && <small className="aoi-provider">{message.provider}</small>}
            </div>
          </div>)}
          {busy && <div className="aoi-message"><img src="/images/aoi-mascot.png" alt=""/><div className="aoi-typing"><i/><i/><i/></div></div>}
          <span ref={bottomRef}/>
        </div>
        <form className="aoi-compose" onSubmit={event => { event.preventDefault(); void send(); }}>
          <input value={input} onChange={event => setInput(event.target.value)} placeholder="Ask about this pond..." aria-label="Ask Aoi"/>
          <button disabled={!input.trim() || busy}>Send</button>
        </form>
        <footer className="aoi-disclaimer">Advice is restricted to current AlgaTwin evidence. Simulations are never presented as measurements.</footer>
      </section>
    </div>
  </>;
}
