import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { pdf } from '@react-pdf/renderer'
import { ExpenseReceiptDoc, RentReceiptDoc } from '@/lib/receipts'
import * as React from 'react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const resendKey = process.env.RESEND_API_KEY || ''

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.substring(7)
    const supabaseWithToken = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { property_id, year, month } = body as { property_id: number, year: number, month: number }
    if (!property_id || !year || !month) {
      return NextResponse.json({ error: 'property_id, year, and month are required' }, { status: 400 })
    }

    // fetch liquidaciones via internal API
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/liquidaciones?property_id=${property_id}&year=${year}&month=${month}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return NextResponse.json({ error: j.error || 'Error fetching liquidaciones' }, { status: 500 })
    }
    const { data }: { data: Array<{ unit_number: string; resident_name?: string; resident_email?: string; expense_due?: number; rent_due?: number }> } = await res.json()

    // Simple text receipts (placeholder). For PDFs, switch to @react-pdf/renderer.
    const resend = new Resend(resendKey)
    const monthName = new Date(0, month - 1).toLocaleString('es-ES', { month: 'long' })

    if (!resendKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
    }

    // Generate and send PDFs
    for (const row of (data || []).filter(d => d.resident_email)) {
      const attachments: Array<{ filename: string; content: string }> = []
      // Expense PDF
      if (row.expense_due) {
        const expenseElement = React.createElement(ExpenseReceiptDoc, { data: {
          propertyName: 'Propiedad',
          unitNumber: row.unit_number,
          residentName: row.resident_name,
          residentEmail: row.resident_email,
          period: { year, month },
          expensePercentage: undefined,
          amount: Number(row.expense_due)
        } })
        const eBuf: Buffer = await toPdfBuffer(expenseElement)
        attachments.push({ filename: `Recibo_Gastos_${row.unit_number}_${monthName}_${year}.pdf`, content: eBuf.toString('base64') })
      }
      // Rent PDF
      if (row.rent_due) {
        const rentElement = React.createElement(RentReceiptDoc, { data: {
          propertyName: 'Propiedad',
          unitNumber: row.unit_number,
          residentName: row.resident_name,
          residentEmail: row.resident_email,
          period: { year, month },
          amount: Number(row.rent_due)
        } })
        const rBuf: Buffer = await toPdfBuffer(rentElement)
        attachments.push({ filename: `Recibo_Alquiler_${row.unit_number}_${monthName}_${year}.pdf`, content: rBuf.toString('base64') })
      }

      await resend.emails.send({
        from: 'no-reply@yourapp.com',
        to: row.resident_email as string,
        subject: `Recibos ${monthName} ${year} - Unidad ${row.unit_number}`,
        text: `Adjuntamos sus recibos para ${monthName} ${year}.`,
        attachments,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send receipts API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function toPdfBuffer(element: unknown): Promise<Buffer> {
  // pdf() expects a React Document element; types are loose, so adapt safely
  const instance = pdf(element as never) as unknown as { toBuffer: () => Promise<Buffer> }
  return instance.toBuffer()
}


