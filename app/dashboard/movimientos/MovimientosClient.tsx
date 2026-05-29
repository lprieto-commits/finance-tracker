'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Upload, X, Check, FileText, ArrowUpRight, ArrowDownRight, ArrowRight, ChevronDown, ChevronUp, Wallet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { formatCurrency, formatDate } from '@/lib/utils'
import NuevoMovimientoModal from '../NuevoMovimientoModal'

interface Movimiento {
  id: string
  tipo: 'ingreso' | 'egreso'
  monto: number
  descripcion: string
  fecha: string
  notas: string | null
  origen: string
  categorias: { id: string; nombre: string; color: string } | null
  cuentas: { id: string; nombre: string; tipo: string } | null
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
  const [modal,      setModal]      = useState(false)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [expandido,  setExpandido]  = useState<string | null>(null)
  const [filas,      setFilas]      = useState<FilaImport[]>([])
  const [importing,  setImporting]  = useState(false)
  const [importOk,   setImportOk]   = useState(false)
  const [importErr,  setImportErr]  = useState('')
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

  // Separar transferencias de movimientos normales para los totales
  const normales      = movimientos.filter(m => m.origen !== 'transferencia')
  const transferencias = movimientos.filter(m => m.origen === 'transferencia')
  const totalIngresos = normales.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const totalEgresos  = normales.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)

  return (
    <>
      {/* Scope tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['personal', 'negocio'] as const).map(s => (
          <a key={s} href={`?desde=${desde}&hasta=${hasta}&scope=${s}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              scope === s ? 'bg-indigo-600 text-white' : 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-500'
            }`}>
            {s === 'personal' ? 'Personal' : 'Negocio'}
          </a>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Desde</label>
          <input type="date" value={localDesde} onChange={e => setLocalDesde(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Hasta</label>
          <input type="date" value={localHasta} onChange={e => setLocalHasta(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Tipo</label>
          <select value={localTipo} onChange={e => setLocalTipo(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Todos</option>
            <option value="ingreso">Ingresos</option>
            <option value="egreso">Egresos</option>
          </select>
        </div>
        <button onClick={applyFilters}
          className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition-colors">
          Filtrar
        </button>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition-colors">
            <Plus className="w-4 h-4" /> Nuevo
          </button>
          <label className="flex items-center gap-2 px-4 py-1.5 bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-600 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" /> Importar
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
          </label>
        </div>
      </div>

      {/* Preview importación */}
      {filas.length > 0 && (
        <div className="bg-slate-900 rounded-2xl border border-amber-700 overflow-hidden">
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
              <thead className="bg-slate-800 border-b border-slate-700 sticky top-0">
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

      {/* Totales — solo movimientos normales */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-900/80 to-emerald-950 rounded-2xl border border-emerald-800/50 p-4 text-center">
          <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wide mb-1">Ingresos</p>
          <p className="text-xl font-bold text-white">{formatCurrency(totalIngresos)}</p>
        </div>
        <div className="bg-gradient-to-br from-red-900/80 to-red-950 rounded-2xl border border-red-800/50 p-4 text-center">
          <p className="text-xs text-red-400 font-semibold uppercase tracking-wide mb-1">Egresos</p>
          <p className="text-xl font-bold text-white">{formatCurrency(totalEgresos)}</p>
        </div>
      </div>

      {/* Lista de movimientos */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm">{movimientos.length} movimiento{movimientos.length !== 1 ? 's' : ''}</h2>
          {transferencias.length > 0 && (
            <span className="text-xs text-indigo-400">{transferencias.length} transferencia{transferencias.length > 1 ? 's' : ''} (no cuentan en totales)</span>
          )}
        </div>

        <ul className="divide-y divide-slate-800/50">
          {movimientos.map(m => {
            const esTransferencia = m.origen === 'transferencia'
            const abierto = expandido === m.id

            return (
              <li key={m.id}>
                {/* Fila principal — click para expandir */}
                <button
                  type="button"
                  onClick={() => setExpandido(abierto ? null : m.id)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Ícono */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      esTransferencia ? 'bg-indigo-500/15' :
                      m.tipo === 'ingreso' ? 'bg-emerald-500/15' : 'bg-red-500/15'
                    }`}>
                      {esTransferencia
                        ? <ArrowRight className="w-4 h-4 text-indigo-400" />
                        : m.tipo === 'ingreso'
                          ? <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                          : <ArrowDownRight className="w-4 h-4 text-red-400" />
                      }
                    </div>

                    {/* Descripción y meta */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{m.descripcion}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {esTransferencia && (
                          <span className="text-xs font-medium text-indigo-400">Transferencia</span>
                        )}
                        {m.categorias && !esTransferencia && (
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.categorias.color }} />
                            <span className="text-xs text-slate-500">{m.categorias.nombre}</span>
                          </span>
                        )}
                        {m.cuentas && (
                          <>
                            {(m.categorias || esTransferencia) && <span className="text-slate-700">·</span>}
                            <span className="inline-flex items-center gap-1">
                              <Wallet className="w-3 h-3 text-slate-600" />
                              <span className="text-xs text-slate-500">{m.cuentas.nombre}</span>
                            </span>
                          </>
                        )}
                        <span className="text-slate-700">·</span>
                        <span className="text-xs text-slate-500">{formatDate(m.fecha)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className={`text-sm font-bold tabular-nums ${
                      esTransferencia ? 'text-indigo-400' :
                      m.tipo === 'ingreso' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {esTransferencia ? '' : m.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(m.monto)}
                    </span>
                    {abierto
                      ? <ChevronUp className="w-4 h-4 text-slate-500" />
                      : <ChevronDown className="w-4 h-4 text-slate-500" />
                    }
                  </div>
                </button>

                {/* Panel expandido */}
                {abierto && (
                  <div className="px-5 pb-4 bg-slate-800/30 border-t border-slate-800/50">
                    <div className="pt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Tipo</p>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          esTransferencia ? 'bg-indigo-500/20 text-indigo-300' :
                          m.tipo === 'ingreso' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                        }`}>
                          {esTransferencia ? 'Transferencia' : m.tipo === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Monto</p>
                        <p className={`font-bold text-base ${
                          esTransferencia ? 'text-indigo-400' :
                          m.tipo === 'ingreso' ? 'text-emerald-400' : 'text-red-400'
                        }`}>{formatCurrency(m.monto)}</p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Fecha</p>
                        <p className="text-white">{formatDate(m.fecha)}</p>
                      </div>

                      {m.cuentas && (
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                            {esTransferencia
                              ? m.tipo === 'egreso' ? 'Cuenta origen' : 'Cuenta destino'
                              : 'Cuenta'
                            }
                          </p>
                          <div className="flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5 text-slate-400" />
                            <p className="text-white">{m.cuentas.nombre}</p>
                          </div>
                        </div>
                      )}

                      {m.categorias && !esTransferencia && (
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Categoría</p>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.categorias.color }} />
                            <span className="text-white">{m.categorias.nombre}</span>
                          </span>
                        </div>
                      )}

                      {m.notas && (
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Notas</p>
                          <p className="text-slate-300">{m.notas}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-end">
                      <button onClick={() => handleDelete(m.id)} disabled={deleting === m.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-900/30 disabled:opacity-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                        {deleting === m.id ? 'Eliminando...' : 'Eliminar movimiento'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}

          {movimientos.length === 0 && (
            <li className="px-5 py-12 text-center text-slate-500">No hay movimientos en este período</li>
          )}
        </ul>
      </div>

      {modal && <NuevoMovimientoModal scope={scope} onClose={() => setModal(false)} onSaved={() => { setModal(false); router.refresh() }} />}
    </>
  )
}
