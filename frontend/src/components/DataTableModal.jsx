import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { X, Table2, Search, SlidersHorizontal, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, Tag, Hash, Calendar, ToggleLeft, Type, Fingerprint } from 'lucide-react'

// ── Column type detection ─────────────────────────────────────────────────────

const DATE_RE = /^\d{4}[-/]\d{1,2}([-/]\d{1,2})?$|^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$|^\d{4}$/
const BOOL_VALUES = new Set(['true','false','yes','no','si','sí','0','1'])
const ID_RE = /^(id|_id|uuid|key|code|codigo|ref)$/i

function detectColType(header, values) {
  const sample = values.filter(v => v !== '' && v != null).slice(0, 60)
  if (!sample.length) return 'text'
  if (ID_RE.test(header.trim())) return 'id'
  const bools = sample.filter(v => BOOL_VALUES.has(String(v).toLowerCase()))
  if (bools.length / sample.length > 0.85) return 'boolean'
  const nums = sample.filter(v => v !== '' && !isNaN(Number(v)))
  if (nums.length / sample.length > 0.85) return 'numeric'
  const dates = sample.filter(v => DATE_RE.test(String(v).trim()))
  if (dates.length / sample.length > 0.7) return 'date'
  const uniq = new Set(sample.map(v => String(v).toLowerCase()))
  if (uniq.size <= Math.min(20, sample.length * 0.4)) return 'categorical'
  return 'text'
}

function buildColMeta(headers, rows) {
  return headers.map(h => {
    const vals = rows.map(r => r[h])
    const type = detectColType(h, vals)
    const nonNull = vals.filter(v => v !== '' && v != null)
    let extra = {}
    if (type === 'numeric') {
      const nums = nonNull.map(Number)
      extra = { min: Math.min(...nums), max: Math.max(...nums) }
    }
    if (type === 'categorical' || type === 'boolean') {
      extra = { options: [...new Set(nonNull.map(v => String(v)))].sort() }
    }
    return { header: h, type, ...extra }
  })
}

// ── Type icons & badges ───────────────────────────────────────────────────────

const TYPE_META = {
  numeric:     { icon: Hash,        color: '#34D399', bg: '#34D39914', label: 'num'  },
  categorical: { icon: Tag,         color: '#A78BFA', bg: '#A78BFA14', label: 'cat'  },
  date:        { icon: Calendar,    color: '#F59E0B', bg: '#F59E0B14', label: 'date' },
  boolean:     { icon: ToggleLeft,  color: '#38BDF8', bg: '#38BDF814', label: 'bool' },
  text:        { icon: Type,        color: '#6B7280', bg: '#6B728014', label: 'text' },
  id:          { icon: Fingerprint, color: '#4B5563', bg: '#4B556314', label: 'id'   },
}

// Notion-style: icon only, very compact
function TypeBadge({ type }) {
  const m = TYPE_META[type] || TYPE_META.text
  const Icon = m.icon
  return (
    <span
      className="inline-flex items-center justify-center rounded"
      style={{ width: 18, height: 14, background: m.bg, color: m.color }}
      title={m.label}
    >
      <Icon className="w-2.5 h-2.5 shrink-0" strokeWidth={2} />
    </span>
  )
}

// ── Inline highlight ──────────────────────────────────────────────────────────

// Always renders exactly ONE <span> — never arrays, never fragments, never split.
// If there's a match, the whole cell gets a subtle background. Simple and crash-free.
function HighlightCell({ val, terms }) {
  const matched = terms.length > 0 && val
    ? terms.some(t => val.toLowerCase().includes(t))
    : false
  return (
    <span style={matched ? { background: 'rgba(56,189,248,0.18)', borderRadius: 3, padding: '0 2px' } : undefined}>
      {val}
    </span>
  )
}

// ── Column alias map ──────────────────────────────────────────────────────────

const ALIAS_GROUPS = [
  ['age','edad','years','años','age_years'],
  ['sex','sexo','gender','genero','género'],
  ['fare','precio','tarifa','price','ticket'],
  ['survived','sobrevivio','sobrevivió','survival','vivo'],
  ['name','nombre','passenger'],
  ['pclass','clase','class','ticket_class'],
  ['embarked','embarcado','port'],
  ['income','ingreso','salary','salario','revenue'],
  ['score','puntuacion','puntuación','result','resultado'],
  ['city','ciudad','location','ubicacion','ubicación'],
  ['category','categoria','categoría','type','tipo'],
  ['species','especie','variedad','variety'],
  ['cluster','grupo','group','segmento','segment'],
  ['price','precio','valor','value','amount'],
]

function buildAliasMap(headers) {
  const map = {}
  for (const h of headers) {
    map[h.toLowerCase()] = h
    for (const group of ALIAS_GROUPS) {
      if (group.includes(h.toLowerCase())) {
        for (const alias of group) map[alias] = h
      }
    }
  }
  return map
}

// ── Smart search parser ───────────────────────────────────────────────────────

const MONTHS = {
  enero:1,jan:1,january:1,febrero:2,february:2,march:3,marzo:3,april:4,abril:4,
  may:5,mayo:5,june:6,junio:6,july:7,julio:7,august:8,agosto:8,
  september:9,septiembre:9,october:10,octubre:10,november:11,noviembre:11,
  december:12,diciembre:12,
}

function parseToken(tok) {
  const op = tok.match(/^([><!]=?|=)(\d+(\.\d+)?)$/)
  if (op) return { kind: 'numeric', op: op[1], val: parseFloat(op[2]) }
  if (/^\d{4}$/.test(tok)) return { kind: 'year', val: tok }
  if (MONTHS[tok.toLowerCase()]) return { kind: 'month', val: MONTHS[tok.toLowerCase()] }
  return { kind: 'text', val: tok.toLowerCase() }
}

// Returns [{col, token, label}] — col is null for all-columns search
function parseColumnAwareTokens(query, aliasMap) {
  const raw = query.trim().split(/\s+/).filter(Boolean)
  const result = []
  let i = 0
  while (i < raw.length) {
    const tok = raw[i]

    // Inline "colname>30" or "colname=5"
    const inlineOp = tok.match(/^(\w+)([><!]=?|=)(\d+(?:\.\d+)?)$/)
    if (inlineOp) {
      const col = aliasMap[inlineOp[1].toLowerCase()]
      if (col) {
        result.push({ col, token: { kind: 'numeric', op: inlineOp[2], val: parseFloat(inlineOp[3]) },
          label: `${col} ${inlineOp[2]} ${inlineOp[3]}` })
        i++; continue
      }
    }

    // Two-token "colname op_value" where next token is operator+number
    const col = tok && aliasMap[tok.toLowerCase()]
    if (col && i + 1 < raw.length) {
      const next = raw[i + 1]
      const numOp = next.match(/^([><!]=?|=)(\d+(?:\.\d+)?)$/)
      if (numOp) {
        result.push({ col, token: { kind: 'numeric', op: numOp[1], val: parseFloat(numOp[2]) },
          label: `${col} ${numOp[1]} ${numOp[2]}` })
        i += 2; continue
      }
      // "colname text_value"
      const nextParsed = parseToken(next)
      if (nextParsed.kind === 'text') {
        result.push({ col, token: nextParsed, label: `${col}: ${next}` })
        i += 2; continue
      }
    }

    // Standard all-columns token
    const parsed = parseToken(tok)
    let label = tok
    if (parsed.kind === 'numeric') label = `${parsed.op} ${parsed.val}`
    else if (parsed.kind === 'year') label = `Año ${parsed.val}`
    else if (parsed.kind === 'month') label = `Mes: ${tok}`
    result.push({ col: null, token: parsed, label })
    i++
  }
  return result
}

function matchCell(raw, token, colType) {
  const str = String(raw ?? '').toLowerCase()
  if (token.kind === 'text') return str.includes(token.val)
  if (token.kind === 'year')  return str.startsWith(token.val) || str.includes(token.val)
  if (token.kind === 'month') {
    const m = str.match(/[-/]0?(\d{1,2})[-/]/)
    return m && parseInt(m[1]) === token.val
  }
  if (token.kind === 'numeric' && colType === 'numeric') {
    const n = parseFloat(raw)
    if (isNaN(n)) return false
    const { op, val } = token
    if (op === '>')  return n > val
    if (op === '>=') return n >= val
    if (op === '<')  return n < val
    if (op === '<=') return n <= val
    if (op === '=' || op === '==') return n === val
  }
  if (token.kind === 'numeric') return str.includes(String(token.val))
  return false
}

// applySearch now accepts aliasMap for column-aware parsing
function applySearch(rows, headers, colMeta, query, aliasMap) {
  if (!query.trim()) return rows
  const colTypeMap = Object.fromEntries(colMeta.map(c => [c.header, c.type]))
  const tokens = parseColumnAwareTokens(query, aliasMap)
  if (!tokens.length) return rows
  return rows.filter(row =>
    tokens.every(({ col, token }) =>
      col
        ? matchCell(row[col], token, colTypeMap[col])
        : headers.some(h => matchCell(row[h], token, colTypeMap[h]))
    )
  )
}

function applyColFilters(rows, colFilters, colMeta) {
  return rows.filter(row =>
    colMeta.every(col => {
      const f = colFilters[col.header]
      if (!f) return true
      const val = row[col.header]
      if (col.type === 'categorical' || col.type === 'boolean') {
        if (!f.selected?.length) return true
        return f.selected.includes(String(val ?? ''))
      }
      if (col.type === 'numeric') {
        const n = parseFloat(val)
        if (isNaN(n)) return f.min == null && f.max == null
        if (f.min != null && n < f.min) return false
        if (f.max != null && n > f.max) return false
        return true
      }
      if (col.type === 'date') {
        if (!f.year) return true
        return String(val ?? '').includes(f.year)
      }
      return true
    })
  )
}

// ── Filter panel components ───────────────────────────────────────────────────

function CatFilter({ col, filter, onChange }) {
  const sel = filter?.selected || []
  const toggle = opt => {
    const next = sel.includes(opt) ? sel.filter(x => x !== opt) : [...sel, opt]
    onChange({ selected: next })
  }
  return (
    <div>
      <p className="text-[10px] font-medium text-[#9CA3AF] mb-1.5">{col.header}</p>
      <div className="flex flex-wrap gap-1 max-h-[72px] overflow-y-auto scrollbar-thin">
        {(col.options || []).map(opt => (
          <button key={opt} onClick={() => toggle(opt)}
            className="px-2 py-0.5 rounded-md text-[10px] font-inter transition-colors"
            style={{
              background: sel.includes(opt) ? '#818CF820' : 'transparent',
              border: `1px solid ${sel.includes(opt) ? '#818CF8' : 'rgba(255,255,255,0.08)'}`,
              color: sel.includes(opt) ? '#818CF8' : '#9CA3AF',
            }}>
            {opt || '(vacío)'}
          </button>
        ))}
      </div>
    </div>
  )
}

function NumFilter({ col, filter, onChange }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-[#9CA3AF] mb-1.5">
        {col.header} <span className="opacity-50">[{col.min} – {col.max}]</span>
      </p>
      <div className="flex gap-2">
        <input type="number" placeholder="Min"
          value={filter?.min ?? ''}
          onChange={e => onChange({ ...filter, min: e.target.value === '' ? null : +e.target.value })}
          className="w-full px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-[#E5E7EB] outline-none focus:border-[#34D399]/40"
        />
        <input type="number" placeholder="Max"
          value={filter?.max ?? ''}
          onChange={e => onChange({ ...filter, max: e.target.value === '' ? null : +e.target.value })}
          className="w-full px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-[#E5E7EB] outline-none focus:border-[#34D399]/40"
        />
      </div>
    </div>
  )
}

function DateFilter({ col, filter, onChange }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-[#9CA3AF] mb-1.5">{col.header}</p>
      <input type="text" placeholder="Ej: 2024, 2023-05"
        value={filter?.year ?? ''}
        onChange={e => onChange({ year: e.target.value })}
        className="w-full px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-[#E5E7EB] outline-none focus:border-[#F59E0B]/40"
      />
    </div>
  )
}

// ── Sort indicator ────────────────────────────────────────────────────────────

function SortIcon({ dir }) {
  return (
    <span className="inline-flex items-center" style={{ opacity: dir ? 1 : 0.2 }}>
      {dir === 'desc'
        ? <ChevronDown className="w-3 h-3 text-[#38BDF8]" strokeWidth={2} />
        : <ChevronUp   className="w-3 h-3 text-[#38BDF8]" strokeWidth={2} />
      }
    </span>
  )
}

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounce(value, ms = 180) {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return dv
}

// ── Chip styles by token kind ─────────────────────────────────────────────────

const CHIP_STYLE = {
  numeric: { bg: 'rgba(52,211,153,0.1)',  color: '#34D399', border: 'rgba(52,211,153,0.3)'  },
  text:    { bg: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: 'rgba(167,139,250,0.3)' },
  year:    { bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B', border: 'rgba(245,158,11,0.3)'  },
  month:   { bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B', border: 'rgba(245,158,11,0.3)'  },
}

// ── Main modal ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export default function DataTableModal({ headers, rows, datasetName, onClose }) {
  const backdropRef   = useRef()
  const [query, setQuery]               = useState('')
  const [colFilters, setColFilters]     = useState({})
  const [sort, setSort]                 = useState({ col: null, dir: null })
  const [page, setPage]                 = useState(1)
  const [showFilters, setShowFilters]   = useState(false)
  const [suggestOpen, setSuggestOpen]   = useState(false)
  const debouncedQuery = useDebounce(query)

  // Escape key
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Column metadata — computed once, stable reference
  const colMeta = useMemo(() => {
    if (!headers || !rows?.length) return []
    return buildColMeta(headers, rows)
  }, [headers, rows])

  // Pre-built lookup map — never call .find() inside render loops
  const colMetaMap = useMemo(() => {
    const m = {}
    colMeta.forEach(c => { m[c.header] = c })
    return m
  }, [colMeta])

  // Alias map for column-aware search (built once per dataset)
  const aliasMap = useMemo(() => buildAliasMap(headers || []), [headers])

  // Filterable cols (exclude id/text for filter panel)
  const filterableCols = useMemo(() =>
    colMeta.filter(c => ['categorical','boolean','numeric','date'].includes(c.type)),
    [colMeta]
  )

  // Active filter count
  const activeFilterCount = useMemo(() => {
    return Object.values(colFilters).filter(f => {
      if (!f) return false
      if (f.selected?.length) return true
      if (f.min != null || f.max != null) return true
      if (f.year) return true
      return false
    }).length
  }, [colFilters])

  // Visual chips from debounced query — stable keys, no array-inline
  const chips = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    return parseColumnAwareTokens(debouncedQuery, aliasMap).map((t, i) => ({
      id: `chip-${i}-${t.label}`,
      label: t.label,
      col: t.col,
      kind: t.token.kind,
    }))
  }, [debouncedQuery, aliasMap])

  // Suggestion index — built ONCE per dataset, never on keystrokes
  // Scans text columns (names, etc.) + categorical options, skips id/numeric/date
  const suggestionIndex = useMemo(() => {
    if (!colMeta.length || !rows?.length) return []
    // Column priority: categorical first, text second, boolean third; skip id/numeric/date
    const TYPE_ORDER = { categorical: 0, text: 1, boolean: 2, numeric: 99, date: 99, id: 99 }
    const sorted = [...colMeta].sort((a, b) =>
      (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9)
    )
    return sorted
      .filter(col => TYPE_ORDER[col.type] < 10)
      .map(col => {
        let values
        if (col.type === 'categorical' || col.type === 'boolean') {
          values = (col.options || []).map(String)
        } else {
          // text column: unique values from first 600 rows, skip garbage
          const seen = new Set()
          values = []
          for (const row of rows.slice(0, 600)) {
            const v = String(row[col.header] ?? '')
            const lo = v.toLowerCase()
            if (v.length >= 2 && v.length <= 60 && !seen.has(lo)
                && lo !== 'nan' && lo !== 'null' && lo !== 'undefined'
                && /[a-z0-9]/i.test(v)) {
              seen.add(lo)
              values.push(v)
              if (values.length >= 300) break
            }
          }
        }
        return { col: col.header, type: col.type, values }
      })
      .filter(entry => entry.values.length > 0)
  }, [colMeta, rows])

  // Suggestions on keystroke — only reads pre-built index (fast)
  // Tier 1: startsWith · Tier 2: includes · max 8 total · grouped by column
  const suggestions = useMemo(() => {
    const lastWord = query.trim().split(/\s+/).pop()?.toLowerCase() || ''
    if (lastWord.length < 2) return []
    const tier1 = []  // startsWith — shown first
    const tier2 = []  // includes   — shown second
    const seenKeys = new Set()
    for (const { col, type, values } of suggestionIndex) {
      for (const v of values) {
        const lo = v.toLowerCase()
        const key = `${col}:${lo}`
        if (seenKeys.has(key)) continue
        if (lo.startsWith(lastWord)) {
          seenKeys.add(key)
          tier1.push({ label: v, col, type })
        } else if (tier1.length + tier2.length < 8 && lo.includes(lastWord)) {
          seenKeys.add(key)
          tier2.push({ label: v, col, type })
        }
      }
      if (tier1.length + tier2.length >= 8) break
    }
    return [...tier1, ...tier2].slice(0, 8)
  }, [query, suggestionIndex])

  // Group suggestions by column for display
  const groupedSuggestions = useMemo(() => {
    const map = {}
    const order = []
    for (const s of suggestions) {
      if (!map[s.col]) { map[s.col] = []; order.push(s.col) }
      map[s.col].push(s)
    }
    return order.map(col => ({ col, items: map[col] }))
  }, [suggestions])

  // Terms to highlight in cells — text tokens only, min 2 chars
  const highlightTerms = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    return parseColumnAwareTokens(debouncedQuery, aliasMap)
      .filter(t => t.token.kind === 'text' && t.token.val.length >= 2)
      .map(t => t.token.val)
  }, [debouncedQuery, aliasMap])

  // Full pipeline: search → colFilters → sort
  const filtered = useMemo(() => {
    if (!rows) return []
    let r = debouncedQuery
      ? applySearch(rows, headers, colMeta, debouncedQuery, aliasMap)
      : rows
    r = applyColFilters(r, colFilters, colMeta)
    if (sort.col) {
      const colType = colMeta.find(c => c.header === sort.col)?.type
      r = [...r].sort((a, b) => {
        const av = a[sort.col] ?? '', bv = b[sort.col] ?? ''
        let cmp = colType === 'numeric'
          ? (parseFloat(av) || 0) - (parseFloat(bv) || 0)
          : String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sort.dir === 'desc' ? -cmp : cmp
      })
    }
    return r
  }, [rows, headers, colMeta, debouncedQuery, colFilters, sort, aliasMap])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = useMemo(() =>
    filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  )

  // Reset page on filter/search change
  useEffect(() => setPage(1), [debouncedQuery, colFilters, sort])

  const handleSort = useCallback(col => {
    setSort(prev =>
      prev.col === col
        ? prev.dir === 'asc' ? { col, dir: 'desc' } : { col: null, dir: null }
        : { col, dir: 'asc' }
    )
  }, [])

  const setColFilter = useCallback((header, value) => {
    setColFilters(prev => ({ ...prev, [header]: value }))
  }, [])

  const clearAll = useCallback(() => {
    setQuery('')
    setColFilters({})
    setSort({ col: null, dir: null })
    setPage(1)
  }, [])

  // Replace last word with suggestion, then refocus
  const applySuggestion = useCallback((label) => {
    const parts = query.trimEnd().split(/\s+/)
    parts[parts.length - 1] = label
    setQuery(parts.join(' ') + ' ')
    setSuggestOpen(false)
  }, [query])

  const hasAnyFilter = query || activeFilterCount > 0 || sort.col

  if (!headers || !rows) return null

  return (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-7xl max-h-[92vh] flex flex-col rounded-2xl border border-white/[0.08] bg-[#0D0D0D] overflow-hidden shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center shrink-0">
              <Table2 className="w-4 h-4 text-[#38BDF8]" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="font-grotesk text-sm font-bold text-[#F5F5F5] leading-tight">
                {datasetName || 'Dataset'}
                <span className="ml-2 text-[10px] font-normal text-[#38BDF8] bg-[#38BDF8]/10 px-1.5 py-0.5 rounded-md">
                  Smart Explorer
                </span>
              </h2>
              <p className="text-[11px] font-inter text-[#9CA3AF] mt-0.5">
                <span className="text-[#F5F5F5]">{filtered.length.toLocaleString()}</span>
                <span className="text-[#38BDF8]" style={{ display: filtered.length !== rows.length ? '' : 'none' }}> de {rows.length.toLocaleString()}</span>
                <span> registros · {headers.length} columnas</span>
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF]/50 hover:text-[#9CA3AF] hover:bg-white/[0.05] transition-colors">
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>

        {/* ── Search bar ── */}
        <div className="px-5 py-3 border-b border-white/[0.05] shrink-0 flex items-center gap-3">
          {/* Input with suggestions dropdown */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]/50 pointer-events-none" strokeWidth={2} />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => setTimeout(() => setSuggestOpen(false), 160)}
              placeholder='Buscar… "female", ">100", "age > 30", "survived", "Barcelona"'
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-[12px] font-inter text-[#E5E7EB] placeholder-[#9CA3AF]/40 outline-none focus:border-[#38BDF8]/30 focus:bg-white/[0.06] transition-all"
            />
            {/* Autocomplete dropdown — grouped by column, absolutely positioned */}
            {suggestOpen && groupedSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-white/[0.1] bg-[#111827] shadow-2xl overflow-hidden">
                {groupedSuggestions.map(({ col, items }) => {
                  const m = TYPE_META[colMetaMap[col]?.type] || TYPE_META.text
                  const Icon = m.icon
                  return (
                    <div key={`grp-${col}`}>
                      <div className="flex items-center gap-1.5 px-3 pt-2 pb-0.5">
                        <Icon className="w-2.5 h-2.5 shrink-0" style={{ color: m.color }} strokeWidth={2} />
                        <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: m.color + 'aa' }}>
                          {col}
                        </span>
                      </div>
                      {items.map((s, i) => (
                        <button
                          key={`sug-${col}-${s.label}-${i}`}
                          onMouseDown={e => { e.preventDefault(); applySuggestion(s.label) }}
                          className="w-full flex items-center px-4 py-1.5 text-left hover:bg-white/[0.05] transition-colors"
                        >
                          <span className="text-[12px] text-[#E5E7EB] font-inter">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Filters toggle */}
          {filterableCols.length > 0 && (
            <button
              onClick={() => setShowFilters(f => !f)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-inter transition-all"
              style={{
                background: showFilters ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${showFilters ? 'rgba(129,140,248,0.35)' : 'rgba(255,255,255,0.08)'}`,
                color: showFilters ? '#818CF8' : '#9CA3AF',
              }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={2} />
              Filtros
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#818CF8] text-white text-[9px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}

          {hasAnyFilter && (
            <button onClick={clearAll}
              className="px-3 py-2 rounded-xl text-[11px] font-inter text-[#9CA3AF]/60 hover:text-[#9CA3AF] border border-white/[0.06] hover:border-white/[0.12] transition-colors">
              Limpiar
            </button>
          )}
        </div>

        {/* ── Search chips — only rendered when there are chips (safe: sibling div, not inside <p>) ── */}
        {chips.length > 0 && (
          <div className="px-5 py-2 flex flex-wrap gap-1.5 border-b border-white/[0.04] shrink-0 bg-[#080808]">
            {chips.map(chip => {
              const s = CHIP_STYLE[chip.kind] || CHIP_STYLE.text
              return (
                <span
                  key={chip.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium font-inter"
                  style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                >
                  {chip.col && (
                    <span className="opacity-60 font-normal">{chip.col}:</span>
                  )}
                  {chip.label}
                </span>
              )
            })}
          </div>
        )}

        {/* ── Filter panel ── */}
        {showFilters && filterableCols.length > 0 && (
          <div className="px-5 py-3 border-b border-white/[0.05] shrink-0 bg-[#080808]">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {filterableCols.map(col => {
                if (col.type === 'categorical' || col.type === 'boolean')
                  return <CatFilter key={col.header} col={col} filter={colFilters[col.header]} onChange={v => setColFilter(col.header, v)} />
                if (col.type === 'numeric')
                  return <NumFilter key={col.header} col={col} filter={colFilters[col.header]} onChange={v => setColFilter(col.header, v)} />
                if (col.type === 'date')
                  return <DateFilter key={col.header} col={col} filter={colFilters[col.header]} onChange={v => setColFilter(col.header, v)} />
                return null
              })}
            </div>
          </div>
        )}

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto scrollbar-thin min-h-0">
          {pageRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Search className="w-8 h-8 text-[#9CA3AF]/20" />
              <p className="text-[13px] font-inter text-[#9CA3AF]/40">Sin resultados para esta búsqueda</p>
              <button onClick={clearAll} className="text-[11px] text-[#38BDF8]/70 hover:text-[#38BDF8] transition-colors">
                Limpiar filtros
              </button>
            </div>
          ) : (
            <table className="w-full text-[12px] font-inter border-collapse">
              <thead className="sticky top-0 z-10 bg-[#0D0D0D]" style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.06)' }}>
                <tr>
                  <th className="px-3 py-2.5 text-left text-[#9CA3AF]/40 font-medium w-10 shrink-0 select-none">#</th>
                  {headers.map(h => {
                    const meta = colMetaMap[h]
                    const isActive = sort.col === h
                    return (
                      <th
                        key={h}
                        onClick={() => handleSort(h)}
                        className="px-3 py-2 text-left whitespace-nowrap cursor-pointer select-none group"
                        style={{ color: isActive ? '#F5F5F5' : '#38BDF8' }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium group-hover:text-[#F5F5F5] transition-colors">{h}</span>
                          <span style={{ visibility: meta ? 'visible' : 'hidden', display: 'inline-flex' }}>
                            {meta && <TypeBadge type={meta.type} />}
                          </span>
                          <SortIcon dir={isActive ? sort.dir : null} />
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => {
                  // Stable key: absolute position in the filtered+sorted array
                  const absIdx = (safePage - 1) * PAGE_SIZE + i
                  return (
                    <tr
                      key={absIdx}
                      className="border-b border-white/[0.025] hover:bg-white/[0.025] transition-colors"
                    >
                      <td className="px-3 py-2 text-[#9CA3AF]/30 tabular-nums text-[11px]">
                        {absIdx + 1}
                      </td>
                      {headers.map(h => {
                        const meta = colMetaMap[h]
                        const raw  = row[h]
                        const isEmpty = raw === '' || raw == null
                        const val  = isEmpty ? '' : String(raw)
                        let color = '#E5E7EB'
                        if (isEmpty)                       color = 'rgba(156,163,175,0.25)'
                        else if (meta?.type === 'numeric') color = '#D1FAE5'
                        else if (meta?.type === 'boolean') color = '#BAE6FD'
                        else if (meta?.type === 'date')    color = '#FDE68A'
                        else if (meta?.type === 'id')      color = '#6B7280'
                        return (
                          <td
                            key={h}
                            className="px-3 py-2 whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis"
                            style={{ color }}
                            title={val || undefined}
                          >
                            {isEmpty
                              ? <span style={{ opacity: 0.3, fontSize: 10 }}>—</span>
                              : <HighlightCell val={val} terms={highlightTerms} />
                            }
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer: pagination + stats ── */}
        <div className="px-5 py-2.5 border-t border-white/[0.06] shrink-0 flex items-center justify-between">
          <p className="text-[11px] font-inter text-[#9CA3AF]/50">
            <span>{'Mostrando '}</span>
            <span className="text-[#F5F5F5]">{filtered.length === 0 ? '0' : `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)}`}</span>
            <span>{' de '}</span>
            <span className="text-[#38BDF8]">{filtered.length.toLocaleString()}</span>
            <span style={{ opacity: filtered.length !== rows.length ? 0.4 : 0 }}>{` (de ${rows.length.toLocaleString()} total)`}</span>
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={safePage === 1}
                className="px-2 py-1 rounded-lg text-[11px] text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-white/[0.05] disabled:opacity-20 transition-colors">
                «
              </button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-white/[0.05] disabled:opacity-20 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p
                if (totalPages <= 5) p = i + 1
                else if (safePage <= 3) p = i + 1
                else if (safePage >= totalPages - 2) p = totalPages - 4 + i
                else p = safePage - 2 + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className="w-7 h-7 rounded-lg text-[11px] font-medium transition-colors"
                    style={{
                      background: p === safePage ? 'rgba(56,189,248,0.15)' : 'transparent',
                      color: p === safePage ? '#38BDF8' : '#9CA3AF',
                      border: p === safePage ? '1px solid rgba(56,189,248,0.3)' : '1px solid transparent',
                    }}>
                    {p}
                  </button>
                )
              })}

              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-white/[0.05] disabled:opacity-20 transition-colors">
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
              <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages}
                className="px-2 py-1 rounded-lg text-[11px] text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-white/[0.05] disabled:opacity-20 transition-colors">
                »
              </button>

              <span className="ml-2 text-[10px] text-[#9CA3AF]/30">
                pág {safePage}/{totalPages}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
