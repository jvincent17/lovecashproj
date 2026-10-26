import { formatAmountInput, parseAmount } from '../lib/format.js'

/** Input nominal rupiah dengan pemisah ribuan otomatis. value = number */
export default function AmountInput({ value, onChange, big = false, autoFocus, placeholder = '0', ...rest }) {
  return (
    <div className={`flex items-center rounded-xl border border-line bg-card focus-within:border-accent ${big ? 'h-16 px-4' : 'h-11 px-3'}`}>
      <span className={`text-muted mr-2 ${big ? 'text-lg' : 'text-sm'}`}>Rp</span>
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value ? formatAmountInput(String(value)) : ''}
        onChange={(e) => onChange(parseAmount(e.target.value))}
        className={`w-full bg-transparent outline-none tabular ${big ? 'text-3xl font-semibold' : 'text-sm'}`}
        {...rest}
      />
    </div>
  )
}
