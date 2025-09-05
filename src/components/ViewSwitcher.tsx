'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Building2, CreditCard } from 'lucide-react'

interface ViewSwitcherProps {
  currentView: 'properties' | 'transactions'
  onViewChange: (view: 'properties' | 'transactions') => void
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ currentView, onViewChange }) => {
  return (
    <div className="flex items-center gap-2">
      <Select value={currentView} onValueChange={onViewChange}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="properties">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>Propiedades</span>
            </div>
          </SelectItem>
          <SelectItem value="transactions">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span>Transacciones Personales</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
