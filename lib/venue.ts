/**
 * Leyte Academic Center grounds, Palo, Leyte, as drawn on the venue map (360×520 plan units, about
 * 3.3 units per metre; rotated from north so the buildings sit square).
 * Building, parking and driveway outlines: © OpenStreetMap contributors, ODbL
 * (ways 246376275, 104625261, 293135659, 245978057, 1192820998).
 */
export const VENUE = {
  /** Annex A. */
  annex: "M54.1 206.9L267.2 206.8L267.1 57.5L54.1 57.5Z",
  /** Corner of the main Leyte Academic Center building (context only). */
  academic: "M29.5 670.6L39.4 387.9L-27.7 387.9L-33.6 601.8L-112.7 600.7L-189.3 599.6L-185.8 385.1L-257.5 382.1L-260.2 665.1L-111.5 667.9Z",
  /** Parking. */
  parking: "M78.9 662.3L78.9 638.8L64.5 638.8L65.2 441.1L232.9 438.4L233.3 664.3L184.1 662.8L188.1 495.6L120.2 493.5L118.2 662.3Z",
  /** East driveway. */
  roads: "M284 710.4L293.3 609.9L302.9 466.7L312.1 411.4L318 324.2L319.2 237.2L319.5 193.9L318.2 186L315.7 178.9L311.9 173.7L307.2 171.7L295.3 171.4L286.8 171.1L279.5 171.2",
} as const;
