// Finding text in the current language. The rules engine returns each
// finding's numbers in `params`; this only puts words around them.
import type { Finding } from './api'
import { getLang } from './i18n'

type Template = { label: string; math: string }

const ES: Record<string, Template | ((p: Record<string, string>) => Template)> = {
  missing_hours: {
    label: '{missing} horas registradas no se pagaron',
    math: '{logged} horas registradas - {paid} horas en el talón = {missing} horas',
  },
  unpaid_regular: {
    label: '{hours} de esas horas eran tiempo regular a {rate}/h',
    math: '{hours} x {rate} = {amount}',
  },
  unpaid_overtime: {
    label: '{hours} de esas horas eran tiempo extra y se deben pagar a {otRate}/h',
    math: '{hours} x {otRate} = {amount}. El tiempo extra es {mult} x {rate} por las horas sobre {threshold} en una semana laboral.',
  },
  extra_hours_on_stub: {
    label: 'El talón muestra {extra} horas más que su registro',
    math: '{paid} horas en el talón - {logged} horas registradas = {extra} horas',
  },
  overtime_at_regular_rate: {
    label: '{hours} horas de tiempo extra parecen pagadas a la tarifa regular en lugar de {otRate}/h',
    math: '{hours} x {premium} extra por hora de tiempo extra = {amount}',
  },
  rate_below_minimum: (p) => ({
    label: 'La tarifa por hora de {rate} es menor que el salario mínimo de Arizona de {min}',
    math: p.amount ? 'Las horas pagadas a {min}/h en lugar de {rate}/h suman {amount} más.' : 'El pago esperado se calcula a {min}/h.',
  }),
  gross_lower_than_stub_hours: {
    label: 'El pago bruto es {remainder} menos de lo que suman las horas y la tarifa del talón',
    math: '{owed} de diferencia total - {explained} explicado arriba = {remainder}',
  },
  total: {
    label: 'Total que posiblemente se le debe: {owed}',
    math: '{expected} esperado por sus horas registradas - {gross} de pago bruto en el talón = {owed}',
  },
  ok: {
    label: 'Su talón de pago cubre las horas de su registro. No parece faltar nada.',
    math: '{expected} esperado por sus horas registradas, {gross} de pago bruto en el talón',
  },
}

const fill = (text: string, params: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (match, key) => (key in params ? params[key] : match))

export function findingText(finding: Finding): Template {
  const template = ES[finding.code]
  if (getLang() !== 'es' || !finding.params || !template) return { label: finding.label, math: finding.math }
  const resolved = typeof template === 'function' ? template(finding.params) : template
  return { label: fill(resolved.label, finding.params), math: fill(resolved.math, finding.params) }
}
