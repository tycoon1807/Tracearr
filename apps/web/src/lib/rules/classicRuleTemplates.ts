/**
 * Classic rule templates for V2 rule builder.
 *
 * When a user selects a "classic" rule type, these templates pre-fill
 * the V2 rule builder with appropriate conditions and a default action.
 */

import type {
  RuleType,
  RuleConditions,
  RuleActions,
  Condition,
  ConditionGroup,
} from '@tracearr/shared';

export interface ClassicRuleTemplate {
  type: RuleType;
  label: string;
  description: string;
  defaultName: string;
  conditions: RuleConditions;
  actions: RuleActions;
}

/**
 * Create a condition group with optional is_local_network filter
 */
function createConditionGroup(
  mainCondition: Condition,
  excludePrivateIps: boolean
): ConditionGroup {
  const conditions: Condition[] = [mainCondition];

  if (excludePrivateIps) {
    conditions.push({
      field: 'is_local_network',
      operator: 'eq',
      value: false,
    });
  }

  return { conditions };
}

/**
 * Default action for all classic rules: create_violation with warning severity
 */
const DEFAULT_ACTIONS: RuleActions = {
  actions: [{ type: 'create_violation', severity: 'warning' }],
};

/**
 * Generate V2 template for Impossible Travel rule
 */
export function createImpossibleTravelTemplate(
  maxSpeedKmh: number = 500,
  excludePrivateIps: boolean = false
): ClassicRuleTemplate {
  return {
    type: 'impossible_travel',
    label: 'Impossible Travel',
    description: 'Detect physically impossible travel between sessions',
    defaultName: 'Impossible Travel Detection',
    conditions: {
      groups: [
        createConditionGroup(
          { field: 'travel_speed_kmh', operator: 'gt', value: maxSpeedKmh },
          excludePrivateIps
        ),
      ],
    },
    actions: DEFAULT_ACTIONS,
  };
}

/**
 * Generate V2 template for Simultaneous Locations rule
 */
export function createSimultaneousLocationsTemplate(
  minDistanceKm: number = 100,
  excludePrivateIps: boolean = false
): ClassicRuleTemplate {
  return {
    type: 'simultaneous_locations',
    label: 'Simultaneous Locations',
    description: 'Detect concurrent sessions from distant locations',
    defaultName: 'Simultaneous Location Detection',
    conditions: {
      groups: [
        createConditionGroup(
          { field: 'active_session_distance_km', operator: 'gte', value: minDistanceKm },
          excludePrivateIps
        ),
      ],
    },
    actions: DEFAULT_ACTIONS,
  };
}

/**
 * Generate V2 template for Device Velocity rule
 */
export function createDeviceVelocityTemplate(
  maxIps: number = 5,
  windowHours: number = 24,
  excludePrivateIps: boolean = false
): ClassicRuleTemplate {
  return {
    type: 'device_velocity',
    label: 'Device Velocity',
    description: 'Detect excessive unique IPs in a time window',
    defaultName: 'Device Velocity Detection',
    conditions: {
      groups: [
        createConditionGroup(
          {
            field: 'unique_ips_in_window',
            operator: 'gt',
            value: maxIps,
            params: { window_hours: windowHours },
          },
          excludePrivateIps
        ),
      ],
    },
    actions: DEFAULT_ACTIONS,
  };
}

/**
 * Generate V2 template for Concurrent Streams rule
 */
export function createConcurrentStreamsTemplate(
  maxStreams: number = 3,
  excludePrivateIps: boolean = false
): ClassicRuleTemplate {
  return {
    type: 'concurrent_streams',
    label: 'Concurrent Streams',
    description: 'Limit simultaneous streams per user',
    defaultName: 'Concurrent Stream Limit',
    conditions: {
      groups: [
        createConditionGroup(
          { field: 'concurrent_streams', operator: 'gt', value: maxStreams },
          excludePrivateIps
        ),
      ],
    },
    actions: DEFAULT_ACTIONS,
  };
}

/**
 * Generate V2 template for Geo Restriction rule
 */
export function createGeoRestrictionTemplate(
  mode: 'blocklist' | 'allowlist' = 'blocklist',
  countries: string[] = []
): ClassicRuleTemplate {
  // blocklist = trigger when country IS IN the list (blocked countries)
  // allowlist = trigger when country IS NOT IN the list (only allow these countries)
  const operator = mode === 'blocklist' ? 'in' : 'not_in';

  return {
    type: 'geo_restriction',
    label: 'Geo Restriction',
    description:
      mode === 'blocklist'
        ? 'Block streaming from specific countries'
        : 'Only allow specific countries',
    defaultName: mode === 'blocklist' ? 'Country Block List' : 'Country Allow List',
    conditions: {
      groups: [
        {
          conditions: [{ field: 'country', operator, value: countries }],
        },
      ],
    },
    actions: DEFAULT_ACTIONS,
  };
}

/**
 * Generate V2 template for Account Inactivity rule
 */
export function createAccountInactivityTemplate(
  inactivityValue: number = 30,
  inactivityUnit: 'days' | 'weeks' | 'months' = 'days'
): ClassicRuleTemplate {
  // Convert to days for the condition
  let days = inactivityValue;
  if (inactivityUnit === 'weeks') days = inactivityValue * 7;
  if (inactivityUnit === 'months') days = inactivityValue * 30;

  return {
    type: 'account_inactivity',
    label: 'Account Inactivity',
    description: 'Detect inactive accounts',
    defaultName: 'Account Inactivity Detection',
    conditions: {
      groups: [
        {
          conditions: [{ field: 'inactive_days', operator: 'gte', value: days }],
        },
      ],
    },
    actions: DEFAULT_ACTIONS,
  };
}

/**
 * Get default template for a classic rule type
 */
export function getClassicRuleTemplate(type: RuleType): ClassicRuleTemplate {
  switch (type) {
    case 'impossible_travel':
      return createImpossibleTravelTemplate();
    case 'simultaneous_locations':
      return createSimultaneousLocationsTemplate();
    case 'device_velocity':
      return createDeviceVelocityTemplate();
    case 'concurrent_streams':
      return createConcurrentStreamsTemplate();
    case 'geo_restriction':
      return createGeoRestrictionTemplate();
    case 'account_inactivity':
      return createAccountInactivityTemplate();
    default:
      return createConcurrentStreamsTemplate();
  }
}

/**
 * All available classic rule templates with their defaults
 */
export const CLASSIC_RULE_TEMPLATES: ClassicRuleTemplate[] = [
  createConcurrentStreamsTemplate(),
  createGeoRestrictionTemplate(),
  createImpossibleTravelTemplate(),
  createSimultaneousLocationsTemplate(),
  createDeviceVelocityTemplate(),
  createAccountInactivityTemplate(),
];
