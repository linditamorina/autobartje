export type ServiceType =
  | "EMERGENCY_TOWING"
  | "ROADSIDE_ASSISTANCE"
  | "DOMESTIC_TRANSPORT"
  | "INTERNATIONAL_TRANSPORT";

export type VehicleType = "CAR" | "SUV" | "VAN" | "MOTORCYCLE" | "LUXURY_LOW";

export type PricingRuleKind =
  | "BASE_FEE"
  | "PER_KM"
  | "SURCHARGE_PERCENT"
  | "SURCHARGE_FIXED"
  | "PER_HOUR"
  | "MINIMUM_PRICE";

/**
 * What makes a surcharge apply. Stored in PricingRule.conditions.trigger.
 * "always" is used for vehicle-type surcharges (filtered by vehicleType).
 */
export type SurchargeTrigger =
  | "always"
  | "night"
  | "weekend"
  | "holiday"
  | "non_drivable"
  | "winch"
  | "enclosed"
  | "express"
  | "highway"
  | "customs"
  | "export_plates"
  | "waiting";

export interface RuleConditions {
  trigger?: SurchargeTrigger;
  /** Night window in local time, e.g. 22 → 6. */
  fromHour?: number;
  toHour?: number;
  minKm?: number;
  maxKm?: number;
}

export interface PricingRule {
  key: string;
  name: string;
  kind: PricingRuleKind;
  /** Cents, or basis points for SURCHARGE_PERCENT. */
  amount: number;
  service: ServiceType | null;
  vehicleType: VehicleType | null;
  conditions: RuleConditions | null;
  priority: number;
  isActive: boolean;
  validFrom: Date | null;
  validTo: Date | null;
}

export interface RouteTariff {
  fromCountry: string;
  fromCity: string | null;
  toCountry: string;
  toCity: string | null;
  vehicleType: VehicleType | null;
  priceCents: number;
  enclosedCents: number | null;
  transitDays: number | null;
  includesCustoms: boolean;
  isActive: boolean;
}

export interface ContractPrice {
  service: ServiceType;
  vehicleType: VehicleType | null;
  baseCents: number | null;
  perKmCents: number | null;
  discountBp: number | null;
  validFrom: Date;
  validTo: Date | null;
}

export interface DiscountCode {
  code: string;
  percentBp: number | null;
  fixedCents: number | null;
  maxUses: number | null;
  usedCount: number;
  validFrom: Date | null;
  validTo: Date | null;
  isActive: boolean;
}

export interface PricingOptions {
  enclosed?: boolean;
  express?: boolean;
  winch?: boolean;
  highway?: boolean;
  customs?: boolean;
  exportPlates?: boolean;
}

export interface PricingInput {
  service: ServiceType;
  vehicleType: VehicleType;
  distanceKm: number;
  isDrivable: boolean;
  options: PricingOptions;
  /** Planned pickup time; null means ASAP (priced at `now`). */
  pickupAt: Date | null;
  waitingHours?: number;
  tollsCents?: number;
  international?: {
    fromCountry: string;
    fromCity?: string | null;
    toCountry: string;
    toCity?: string | null;
  };
}

export interface PricingContext {
  rules: PricingRule[];
  routeTariffs?: RouteTariff[];
  contract?: ContractPrice[];
  discount?: DiscountCode | null;
  /** Dates (YYYY-MM-DD, local) that count as public holidays. */
  holidays?: string[];
  vatRateBp?: number;
  timeZone?: string;
  now?: Date;
}

export interface PriceLine {
  key: string;
  label: string;
  cents: number;
}

export type PriceSource = "rules" | "route_tariff" | "contract";

export interface PriceResult {
  ok: true;
  source: PriceSource;
  lines: PriceLine[];
  netCents: number;
  vatCents: number;
  totalCents: number;
  transitDays: number | null;
}

export interface PriceUnavailable {
  ok: false;
  reason: "no_route_tariff" | "no_base_rule";
}
