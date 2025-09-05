'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: number | string
  onChange?: (value: string) => void
  onRawValueChange?: (rawValue: number | null) => void
  className?: string
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, onRawValueChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState<string>('')
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [cursorPosition, setCursorPosition] = React.useState<number>(0)

    // Format number with dots as thousand separators using German locale
    const formatNumber = (num: string | number): string => {
      if (!num && num !== 0) return ''

      // Convert to string and remove any existing formatting
      const cleanValue = String(num).replace(/\./g, '').replace(/,/g, '')

      // Parse as number
      const parsed = Number(cleanValue)
      if (isNaN(parsed)) return ''

      // Format with German locale (dots as thousands separators)
      return new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(parsed)
    }

    // Extract raw numeric value from formatted display
    const extractRawValue = (formattedValue: string): number | null => {
      // Handle German format: replace comma with dot for parsing
      const cleanValue = formattedValue.replace(/\./g, '').replace(',', '.')
      const parsed = parseFloat(cleanValue)
      return isNaN(parsed) ? null : parsed
    }

    // Calculate cursor position adjustment after formatting
    const calculateCursorPosition = (
      oldValue: string,
      newValue: string,
      oldCursorPos: number
    ): number => {
      // Count dots in old and new values up to cursor position
      const oldDots = (oldValue.slice(0, oldCursorPos).match(/\./g) || []).length
      const newDots = (newValue.slice(0, oldCursorPos).match(/\./g) || []).length

      // Adjust cursor position based on dot difference
      return Math.max(0, Math.min(newValue.length, oldCursorPos + (newDots - oldDots)))
    }

    // Update display value when value prop changes
    React.useEffect(() => {
      if (value !== undefined) {
        const formatted = formatNumber(value)
        setDisplayValue(formatted)
      }
    }, [value])

    // Combine refs
    React.useImperativeHandle(ref, () => inputRef.current!, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      const currentCursorPos = e.target.selectionStart || 0

      // Allow only numbers, dots (thousand separators), and commas (decimal separator)
      if (!/^[0-9.,]*$/.test(inputValue)) {
        return
      }

      // Store the old value and cursor position for adjustment
      const oldDisplayValue = displayValue
      const oldCursorPos = currentCursorPos

      // Remove existing formatting dots and reformat
      const cleanValue = inputValue.replace(/\./g, '')
      const formattedValue = cleanValue ? formatNumber(cleanValue) : ''

      // Calculate new cursor position
      const newCursorPos = calculateCursorPosition(
        oldDisplayValue,
        formattedValue,
        oldCursorPos
      )

      setDisplayValue(formattedValue)
      setCursorPosition(newCursorPos)

      // Extract and send raw numeric value
      const rawValue = extractRawValue(cleanValue)
      onRawValueChange?.(rawValue)
      onChange?.(cleanValue)
    }

    // Restore cursor position after formatting
    React.useEffect(() => {
      if (inputRef.current && cursorPosition !== undefined) {
        inputRef.current.setSelectionRange(cursorPosition, cursorPosition)
      }
    }, [cursorPosition, displayValue])

    const handleFocus = () => {
      // Store current cursor position
      if (inputRef.current) {
        setCursorPosition(inputRef.current.selectionStart || 0)
      }
    }

    const handleBlur = () => {
      // Ensure proper formatting on blur
      if (displayValue) {
        const cleanValue = displayValue.replace(/\./g, '')
        const formatted = formatNumber(cleanValue)
        setDisplayValue(formatted)
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow navigation keys, backspace, delete, etc.
      const allowedKeys = [
        'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End'
      ]

      if (!allowedKeys.includes(e.key) && !/^\d$/.test(e.key) && e.key !== ',') {
        e.preventDefault()
      }
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      // Handle paste events by cleaning the pasted content
      e.preventDefault()
      const pastedText = e.clipboardData.getData('text')
      const cleanText = pastedText.replace(/[^\d,]/g, '')

      if (cleanText) {
        const formattedValue = formatNumber(cleanText)
        setDisplayValue(formattedValue)

        const rawValue = extractRawValue(cleanText)
        onRawValueChange?.(rawValue)
        onChange?.(cleanText)
      }
    }

    // Method to get raw numeric value (exposed to parent)
    const getRawValue = (): number | null => {
      return extractRawValue(displayValue.replace(/\./g, ''))
    }

    // Expose getRawValue method via ref
    React.useImperativeHandle(ref, () => ({
      ...inputRef.current!,
      getRawValue
    }), [])

    return (
      <Input
        {...props}
        ref={inputRef}
        className={cn(className)}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        inputMode="numeric"
        autoComplete="off"
        spellCheck="false"
      />
    )
  }
)

NumberInput.displayName = 'NumberInput'

export { NumberInput }
