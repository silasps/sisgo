export type DeviceModel = {
  id: string
  organization_id: string | null
  brand: string
  model: string
  label: string
  start_url_template: string
  stop_url_template: string
  status_url_template: string
  setup_instructions: string | null
  is_global: boolean
}

export function buildUrl(template: string, ip: string, seconds: number): string {
  return template
    .replace(/\{ip\}/g, ip)
    .replace(/\{seconds\}/g, String(seconds))
}
