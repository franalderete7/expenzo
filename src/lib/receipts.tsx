import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export type ReceiptPeriod = { year: number; month: number }

export type ReceiptCommon = {
  propertyName: string
  unitNumber: string
  residentName?: string
  residentEmail?: string
  period: ReceiptPeriod
}

export type ExpenseReceiptData = ReceiptCommon & {
  expensePercentage?: number
  amount: number
}

export type RentReceiptData = ReceiptCommon & {
  amount: number
}

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 11, fontFamily: 'Helvetica' },
  header: { marginBottom: 12 },
  title: { fontSize: 16, fontWeight: 700 },
  sub: { color: '#666' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  box: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 12, marginTop: 12 },
  label: { color: '#444' },
  value: { fontWeight: 700 },
})

function monthNameEs(month: number) {
  return new Date(0, month - 1).toLocaleString('es-ES', { month: 'long' })
}

export function ExpenseReceiptDoc({ data }: { data: ExpenseReceiptData }) {
  const { propertyName, unitNumber, residentName, residentEmail, period, expensePercentage, amount } = data
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Recibo de Gastos</Text>
          <Text style={styles.sub}>
            {propertyName} · Unidad {unitNumber} · {monthNameEs(period.month)} {period.year}
          </Text>
        </View>
        <View style={styles.box}>
          <View style={styles.row}><Text style={styles.label}>Residente:</Text><Text style={styles.value}>{residentName || 'N/A'}</Text></View>
          {residentEmail && (
            <View style={styles.row}><Text style={styles.label}>Email:</Text><Text style={styles.value}>{residentEmail}</Text></View>
          )}
          {typeof expensePercentage === 'number' && (
            <View style={styles.row}><Text style={styles.label}>% de gastos:</Text><Text style={styles.value}>{expensePercentage}%</Text></View>
          )}
          <View style={styles.row}><Text style={styles.label}>Total a pagar:</Text><Text style={styles.value}>${amount.toFixed(2)}</Text></View>
        </View>
      </Page>
    </Document>
  )
}

export function RentReceiptDoc({ data }: { data: RentReceiptData }) {
  const { propertyName, unitNumber, residentName, residentEmail, period, amount } = data
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Recibo de Alquiler</Text>
          <Text style={styles.sub}>
            {propertyName} · Unidad {unitNumber} · {monthNameEs(period.month)} {period.year}
          </Text>
        </View>
        <View style={styles.box}>
          <View style={styles.row}><Text style={styles.label}>Inquilino:</Text><Text style={styles.value}>{residentName || 'N/A'}</Text></View>
          {residentEmail && (
            <View style={styles.row}><Text style={styles.label}>Email:</Text><Text style={styles.value}>{residentEmail}</Text></View>
          )}
          <View style={styles.row}><Text style={styles.label}>Total a pagar:</Text><Text style={styles.value}>${amount.toFixed(2)}</Text></View>
        </View>
      </Page>
    </Document>
  )
}


