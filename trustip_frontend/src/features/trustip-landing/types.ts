export type NavItem = {
  id: string
  label: string
  n: string
}

export type MockWallet = {
  id: string
  name: string
  network: string
  __mock: true
}

export type MockOrder = {
  code: string
  buyer: string
  item: string
  amount: string
  route: string
  status: string
  __mock: true
}

export type MockProofItem = {
  label: string
  value: string
  mono?: boolean
  accent?: boolean
}

export type PayoutRoute = {
  id: string
  label: string
  desc: string
  eta: string
  icon: string
}

export type TrustMetric = {
  label: string
  value: number
  suffix?: string
  decimals?: number
  sub: string
}

export type RailState = {
  n: string
  id: string
  /** Buyer-facing Indonesian display label (approved UX language). */
  label: string
  /** English mono micro-label. */
  en: string
}

export type EvidencePlate = {
  id: string
  tag: string
  title: string
  note: string
}
