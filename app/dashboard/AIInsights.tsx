'use client'

import { useState } from 'react'
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

export default function AIInsights({ anio, mes }: { anio: number; mes: number }) {
  const [loading, setLoading]     = useState(false)
  const [insights, setInsights]   = useState<string | null>(null)
  const [expanded, setExpanded]   = useState(false)
  const [error, setError]         = useState('')

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'insights', anio, mes }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error ?? `Error ${res.status}`); return }
      setInsights(data.texto)
      setExpanded(true)
    } catch (e: any) {
      setError(e?.message ?? 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  function renderMarkdown(text: string) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
      .replace(/^## (.*)/gm, '<h3 class="text-indigo-400 font-bold mt-4 mb-1.5">$1</h3>')
      .replace(/^# (.*)/gm, '<h2 class="text-white font-bold text-base mt-4 mb-2">$1</h2>')
      .replace(/^\d+\. (.*)/gm, '<div class="flex gap-2 mb-1"><span class="text-indigo-400 font-bold shrink-0">•</span><span>$1</span></div>')
      .replace(/^- (.*)/gm, '<div class="flex gap-2 mb-1"><span class="text-slate-500 shrink-0">–</span><span>$1</span></div>')
      .replace(/\n\n/g, '<br/><br/>')
  }

  return (
    <div className={`bg-slate-900 rounded-2xl border overflow-hidden transition-all ${insights ? 'border-indigo-800/50' : 'border-slate-800'}`}>
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">Análisis con IA</h2>
            <p className="text-xs text-slate-500">Insights personalizados para este mes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {insights && (
            <button onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-indigo-900/50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Analizando...' : insights ? 'Regenerar' : 'Analizar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-6 pb-4">
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">{error}</p>
        </div>
      )}

      {loading && (
        <div className="px-6 pb-6">
          <div className="space-y-2">
            {[100, 80, 90, 60].map((w, i) => (
              <div key={i} className="h-3 bg-slate-800 rounded-full animate-pulse" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      )}

      {insights && expanded && (
        <div className="px-6 pb-6">
          <div
            className="text-sm text-slate-300 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(insights) }}
          />
        </div>
      )}
    </div>
  )
}
