import { useEffect, useState } from 'react';
import { api } from '../api';
import { useClinic } from '../clinic';

const MODELS = ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o'];

const INITIAL_PROMPT = `Sos un asistente digital de la clínica, no una persona. Decilo con naturalidad la primera vez que hablás.
Respondé en español, breve y cercano.
En el primer mensaje saludá una sola vez, presentate como asistente digital y preguntá el nombre.
Cuando te digan el nombre, usalo en los mensajes siguientes. No vuelvas a saludar ni a presentarte si la conversación ya empezó.
Usá solo los datos de la clínica que te paso. Si piden un turno, mandá el link de reserva. No inventes precios, horarios ni profesionales.`;

export default function ChatbotPage() {
  const { settings, reload } = useClinic();
  const [form, setForm] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!settings) return;
    setForm({
      enabled: settings.chatbot_enabled !== false,
      model: settings.chatbot_model || 'gpt-4.1-mini',
      prompt: settings.chatbot_prompt?.trim() || INITIAL_PROMPT,
    });
    setPhoneNumberId(settings.chatbot_phone_number_id || settings.kapso_phone_number_id || '');
  }, [settings]);

  if (!form) return <div className="p-6">Cargando…</div>;

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <h1 className="mb-2 text-2xl">Chatbot</h1>
      <p className="mb-4 max-w-xl text-sm text-[#70757a]">
        Responde por WhatsApp con GPT usando los servicios, profesionales y horarios de la clínica. Si piden un turno, manda el link para reservar.
      </p>
      {error && <div className="mb-3 max-w-xl rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-3 max-w-xl rounded-lg bg-[#e6f4ea] px-3 py-2 text-sm text-[#0b8043]">{message}</div>}
      <form
        className="max-w-xl space-y-4"
        onSubmit={async (ev) => {
          ev.preventDefault();
          setError('');
          try {
            await api.saveSettings({
              chatbotEnabled: form.enabled,
              chatbotModel: form.model,
              chatbotPrompt: form.prompt,
            });
            await reload();
            setMessage('Chatbot guardado');
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          Activo
        </label>
        <label className="field">
          <span>Modelo</span>
          <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}>
            {MODELS.map((model) => <option key={model} value={model}>{model}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Prompt principal</span>
          <textarea rows={8} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} />
        </label>
        <button className="pill-btn primary" type="submit">Guardar chatbot</button>
      </form>
      <div className="mt-6 max-w-xl space-y-3">
        <button
          className="pill-btn"
          type="button"
          onClick={async () => {
            setError('');
            try {
              const list = await api.kapsoNumbers();
              setNumbers(list);
              if (!list.length) setMessage('Kapso no devolvió números de WhatsApp.');
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          Ver números de Kapso
        </button>
        {numbers.length > 0 && (
          <label className="field">
            <span>Número</span>
            <select value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)}>
              <option value="">Elegir…</option>
              {numbers.map((item) => {
                const id = item.id || item.phone_number_id;
                const label = item.display_phone_number || item.phone_number || item.name || id;
                return <option key={id} value={id}>{label}</option>;
              })}
            </select>
          </label>
        )}
        <button
          className="pill-btn primary"
          type="button"
          onClick={async () => {
            setError('');
            try {
              await api.connectKapso(phoneNumberId || settings.chatbot_phone_number_id);
              await reload();
              setMessage('Webhook de WhatsApp conectado.');
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          Conectar webhook
        </button>
        {settings.chatbot_phone_number_id && (
          <p className="text-sm text-[#70757a]">Número conectado: {settings.chatbot_phone_number_id}</p>
        )}
      </div>
    </div>
  );
}
