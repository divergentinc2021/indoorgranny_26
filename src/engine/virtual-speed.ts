// Vendor model: drivetrain-adjusted power (0.95·P) balances aero drag plus rolling resistance, using the vendor constants verbatim.
const AERO = 0.5 * 1.1865 * 0.388;
const ROLL = 0.004 * 735;
const EFFICIENCY = 0.95;
const MAX_MS = 30;

/** Speed in m/s that a rider putting out powerW would hold on the flat, solved by Newton from v = 5. */
export function virtualSpeedMs(powerW: number): number {
  if (!(powerW > 0)) return 0;
  const target = EFFICIENCY * powerW;
  let v = 5;
  for (let i = 0; i < 8; i++) v -= (AERO * v ** 3 + ROLL * v - target) / (3 * AERO * v ** 2 + ROLL);
  return Math.min(MAX_MS, Math.max(0, v));
}
