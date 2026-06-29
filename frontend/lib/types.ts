import { risk } from './tokens'

export type RiskLevel = keyof typeof risk

export const RISK = risk

export interface HazardRisk {
  krupy: number
  burky: number
  vietor: number
  dazd: number
}

export interface KrajData {
  slug: string
  name: string
  risk: RiskLevel
  hazards: HazardRisk
  okresy: OkresData[]
}

export interface OkresData {
  slug: string
  name: string
  krajSlug: string
  risk: RiskLevel
  hazards: HazardRisk
  obce: ObecData[]
}

export interface ObecData {
  slug: string
  name: string
  okresSlug: string
  krajSlug: string
  lat: number
  lon: number
  risk: RiskLevel
  hazards: HazardRisk
  audit: AuditTrail | null
}

export interface AuditTrail {
  updatedAt: string
  cape: number
  liftedIndex: number
  radarCell: {
    distanceKm: number
    intensityDbz: number
    direction: string
    speedKmh: number
    etaMinutes: number
  } | null
  explanation: string
}
