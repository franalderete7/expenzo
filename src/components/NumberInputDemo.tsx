'use client'

import * as React from 'react'
import { NumberInput } from '@/components/ui/number-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const NumberInputDemo: React.FC = () => {
  const [value, setValue] = React.useState<string>('')
  const [rawValue, setRawValue] = React.useState<number | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleValueChange = (newValue: string) => {
    setValue(newValue)
  }

  const handleRawValueChange = (newRawValue: number | null) => {
    setRawValue(newRawValue)
  }

  const getRawValueFromRef = () => {
    if (inputRef.current && 'getRawValue' in inputRef.current) {
      const raw = (inputRef.current as { getRawValue: () => number | null }).getRawValue()
      alert(`Raw value from ref: ${raw}`)
    }
  }

  const examples = [
    { label: 'Small number', value: '1234' },
    { label: 'Medium number', value: '56789' },
    { label: 'Large number', value: '1234567' },
    { label: 'Decimal number', value: '1234,56' },
    { label: 'Large decimal', value: '1234567,89' }
  ]

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Enhanced NumberInput Component</CardTitle>
        <CardDescription>
          Demonstrates numeric input with German locale formatting (dots as thousand separators)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Demo Input */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Interactive Demo</h3>
          <div className="space-y-2">
            <label className="text-sm font-medium">Enter a number:</label>
            <NumberInput
              ref={inputRef}
              value={value}
              onChange={handleValueChange}
              onRawValueChange={handleRawValueChange}
              placeholder="Type a number..."
              className="w-full"
            />
          </div>

          {/* Value Display */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Badge variant="secondary">Display Value</Badge>
              <p className="text-sm font-mono p-2 bg-muted rounded">{value || 'Empty'}</p>
            </div>
            <div className="space-y-1">
              <Badge variant="secondary">Raw Numeric Value</Badge>
              <p className="text-sm font-mono p-2 bg-muted rounded">{rawValue ?? 'null'}</p>
            </div>
          </div>

          <Button onClick={getRawValueFromRef} variant="outline">
            Get Raw Value from Ref
          </Button>
        </div>

        {/* Examples */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Formatting Examples</h3>
          <div className="grid grid-cols-2 gap-4">
            {examples.map((example, index) => (
              <div key={index} className="space-y-2">
                <label className="text-sm font-medium">{example.label}:</label>
                <NumberInput
                  value={example.value}
                  readOnly
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Raw: {example.value} → Display: {new Intl.NumberFormat('de-DE').format(Number(example.value))}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ul className="space-y-2 text-sm">
              <li>✅ German locale formatting (dots as separators)</li>
              <li>✅ Real-time formatting during typing</li>
              <li>✅ Cursor position preservation</li>
              <li>✅ Copy/paste support with cleaning</li>
              <li>✅ Raw value extraction methods</li>
            </ul>
            <ul className="space-y-2 text-sm">
              <li>✅ Input validation (numbers only)</li>
              <li>✅ Proper blur/focus handling</li>
              <li>✅ Empty input handling</li>
              <li>✅ Edge case management</li>
              <li>✅ TypeScript support</li>
            </ul>
          </div>
        </div>

        {/* Usage */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Usage</h3>
          <div className="bg-muted p-4 rounded-lg">
            <pre className="text-sm overflow-x-auto">
{`<NumberInput
  ref={inputRef}
  value={value}
  onChange={handleValueChange}
  onRawValueChange={handleRawValueChange}
  placeholder="Enter amount..."
  className="w-full"
/>

// Get raw numeric value
const rawValue = inputRef.current?.getRawValue()`}
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
