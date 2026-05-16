import { FileScan, Upload } from 'lucide-react'

export default function CSVPicker({ onPick, onFile, disabled }) {
  const handleNativePick = async event => {
    event?.stopPropagation()
    if (disabled) return

    onPick?.()

    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [{
            description: 'CSV files',
            accept: { 'text/csv': ['.csv'] },
          }],
        })
        const file = await handle.getFile()
        if (file?.name.endsWith('.csv')) {
          onFile(file)
        }
        return
      } catch (error) {
        if (error?.name === 'AbortError') return
      }
    }

    document.getElementById('siri-data-fallback')?.click()
  }

  return (
    <div className="csv-picker">
      <input
        id="siri-data-fallback"
        type="file"
        accept=".csv"
        className="hidden"
        onChange={event => {
          event.stopPropagation()
          const file = event.target.files?.[0]
          if (file) {
            onFile(file)
          }
        }}
      />
      <button type="button" onClick={handleNativePick} disabled={disabled} className="csv-picker-button">
        <span className="csv-picker-icon">
          <FileScan className="w-6 h-6" strokeWidth={1.5} />
        </span>
        <span>
          <strong>Seleccionar CSV</strong>
          <small>Selector moderno · solo .csv</small>
        </span>
        <Upload className="w-4 h-4 opacity-70" strokeWidth={1.5} />
      </button>
    </div>
  )
}
