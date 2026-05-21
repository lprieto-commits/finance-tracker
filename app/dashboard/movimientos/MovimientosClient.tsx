'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Upload, X, Check, FileText } from 'lucide-react'
import * as XLSX from 'xlsx'
import { formatCurrency, formatDate } from '@/lib/utils'
import NuevoMovimientoModal from '../NuevoMovimientoModal'

interface Movimiento {
  id: string; tipo: 'ingreso' | 'egreso'; monto: number
  descripcion: string; fecha: string; notas: string | null; origen: string
  categorias: { id: string; nombre: string; color: string } | null
}

interface Props {
  movimientos: Movimiento[]
  categorias:  any[]
  desde: string; hasta: string
  scope: 'personal' | 'negocio'
  tipoFiltro: string
}

interface FilaImport { fecha: string; descripcion: string; monto: number; tipo: 'ingreso' | 'egreso' }

function excelDateToISO(val: unknown): string {
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  if (typeof val === 'string') {
    const m = val.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
    if (m) {
      const [, d, mo, y] = m
      return `${y.length === 2 ? '20'+y : y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
    }
    return val.slice(0, 10)
  }
  return new Date().toISOString().slice(0, 10)
}

export default function MovimientosClient({ movimientos, desde, hasta, scope, tipoFiltro }: Props) {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [modal,     setModal]     = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [filas,     setFilas]     = useState<FilaImport[]>([])
  const [importing, setImporting] = useState(false)
  const [importOk,  setImportOk]  = useState(false)
  const [importErr, setImportErr] = useState('')
  const [localDesde, setLocalDesde] = useState(desde)
  const [localHasta, setLocalHasta] = useState(hasta)
  const [localTipo,  setLocalTipo]  = useState(tipoFiltro)

  function applyFilters() {
    const p = new URLSearchParams({ desde: localDesde, hasta: localHasta, scope })
    if (localTipo) p.set('tipo', localTipo)
    router.push(`?${p}`)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este movimiento?')) return
    setDeleting(id)
    try {
      await fetch(`/api/movimientos/${id}`, { method: 'DELETE' })
      router.refresh()
    } finally { setDeleting(null) }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportErr(''); setImportOk(false)
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const wb   = XLSX.read(ev.target?.result, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
        const hdrs = (rows[0] as string[]).map(h => String(h).toLowerCase().trim())
        const iDate  = hdrs.findIndex(h => h.includes('fecha') || h.includes('date'))
        const iDesc  = hdrs.findIndex(h => h.includes('descrip') || h.includes('concepto') || h.includes('detalle'))
        const iMonto = hdrs.findIndex(h => h.includes('monto') || h.includes('importe') || h.includes('valor'))
        const iDeb   = hdrs.findIndex(h => h.includes('débito') || h.includes('debito') || h.includes('egreso') || h.includes('salida'))
        const iCre   = hdrs.findIndex(h => h.includes('crédito') || h.includes('credito') || h.includes('ingreso') || h.includes('entrada'))
        const parsed: FilaImport[] = []
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as unknown[]
          if (!row || row.every(c => c === '' || c == null)) continue
          const fecha       = excelDateToISO(row[iDate !== -1 ? iDate : 0])
          const descripcion = String(row[iDesc !== -1 ? iDesc : 1] ?? '').trim() || 'Sin descripción'
          let monto = 0, tipo: 'ingreso' | 'egreso' = 'egreso'
          if (iDeb !== -1 || iCre !== -1) {
            const deb = parseFloat(String(row[iDeb] ?? 0)) || 0
            const cre = parseFloat(String(row[iCre] ?? 0)) || 0
            if (cre > 0) { monto = cre; tipo = 'ingreso' }
            else if (deb > 0) { monto = deb; tipo = 'egreso' }
            else continue
          } else if (iMonto !== -1) {
            const m = parseFloat(String(row[iMonto] ?? 0)) || 0
            if (m === 0) continue
            monto = Math.abs(m); tipo = m < 0 ? 'egreso' : 'ingreso'
          } else continue
          parsed.push({ fecha, descripcion, monto, tipo })
        }
        if (parsed.length === 0) { setImportErr('No se encontraron filas válidas.'); return }
        setFilas(parsed)
      } catch { setImportErr('Error al leer el archivo.') }
    }
    reader.readAsArrayBuffer(file)
  }

  async function confirmarImport() {
    setImporting(true); setImportErr('')
    try {
      const res = await fetch('/api/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movimientos: filas, scope }),
      })
      const data = await res.json()
      if (!res.ok) { setImportErr(data.error ?? 'Error'); return }
      setImportOk(true); setFilas([])
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } finally { setImporting(false) }
  }

  const totalIngresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const totalEgresos  = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)

  return (
    <>
      {/* Scope tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['personal', 'negocio'] as const).map(s => (
          <a key={s} href={`?desde=${desde}&hasta=${hasta}&scope=${s}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              scope === s ? 'bg-indigo-600 text-white' : 'bg-slate-800 border border-slate-600 text-slate-300 hover:border-slate-500'
            }`}>
            {s === 'personal' ? 'Personal' : 'Negocio'}
          </a>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Desde</label>
          <input type="date" value={localDesde} onChange={e => setLocalDesde(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-600 bg-slate-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Hasta</label>
          <input type="date" value={localHasta} onChange={e => setLocalHasta(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-600 bg-slate-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Tipo</label>
          <select value={localTipo} onChange={e => setLocalTipo(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-600 bg-slate-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Todos</option>
            <option value="ingreso">Ingresos</option>
            <option value="egreso">Egresos</option>
          </select>
        </div>
        <button onClick={applyFilters}
          className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
          Filtrar
        </button>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> Nuevo
          </button>
          <label className="flex items-center gap-2 px-4 py-1.5 bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-600 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" /> Importar CSV/XLSX
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
          </label>
        </div>
      </div>

      {/* Preview importación */}
      {filas.length > 0 && (
        <div className="bg-slate-800 rounded-2xl border border-amber-700 overflow-hidden">
          <div className="px-5 py-4 bg-amber-900/40 border-b border-amber-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-amber-300 text-sm">{filas.length} filas detectadas</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setFilas([]); if (fileRef.current) fileRef.current.value = '' }}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
              <button onClick={confirmarImport} disabled={importing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                <Check className="w-3.5 h-3.5" />
                {importing ? 'Importando...' : 'Confirmar'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-56">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 border-b border-slate-700 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-400">Fecha</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-400">Descripción</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-400">Tipo</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-400">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filas.slice(0, 50).map((f, i) => (
                  <tr key={i} className="hover:bg-slate-700/50">
                    <td className="px-4 py-2 text-slate-400">{f.fecha}</td>
                    <td className="px-4 py-2 text-white">{f.descripcion}</td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${f.tipo === 'ingreso' ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
                        {f.tipo}
                      </span>
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold ${f.tipo === 'ingreso' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(f.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importErr && <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm">{importErr}</div>}
      {importOk  && <div className="bg-emerald-950 border border-emerald-800 rounded-xl px-4 py-3 text-emerald-400 text-sm font-medium">Importación exitosa</div>}

      {/* Totales */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Total ingresos</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(totalIngresos)}</p>
        </div>
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Total egresos</p>
          <p className="text-xl font-bold text-red-400">{formatCurrency(totalEgresos)}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-white text-sm">{movimientos.length} movimiento{movimientos.length !== 1 ? 's' : ''}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-400">Descripción</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">Categoría</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">Fecha</th>
                <th className="text-right px-4 py-3 font-medium text-slate-400">Monto</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {movimientos.map(m => (
                <tr key={m.id} className="hover:bg-slate-700/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{m.descripcion}</p>
                    {m.notas && <p className="text-xs text-slate-500 mt-0.5">{m.notas}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {m.categorias
                      ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-200">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.categorias.color }} />
                          {m.categorias.nombre}
                        </span>
                      : <span className="text-slate-500 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(m.fecha)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${m.tipo === 'ingreso' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {m.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(m.monto)}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(m.id)} disabled={deleting === m.id}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950 disabled:opacity-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {movimientos.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No hay movimientos en este período</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <NuevoMovimientoModal scope={scope} onClose={() => setModal(false)} onSaved={() => { setModal(false); router.refresh() }} />}
    </>
  )
}
