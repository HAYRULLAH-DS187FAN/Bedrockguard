import type { AgentEventPayload, PlatformProfile, ShadowMovementObservation } from "../../shared/guard";

export type ShadowAssessment = {
  candidateType: ShadowMovementObservation["candidateType"];
  severity: number;
  evidenceQuality: number;
  platformFit: number;
  status: "observed" | "suppressed";
  suppressionReason?: string;
  profile: PlatformProfile;
};

const explanatoryEnvironment = new Set(["water", "bubble_column", "vehicle", "elytra", "creative", "spectator", "slime", "piston", "knockback", "teleport", "bamboo_nearby"]);

export function profileForObservation(event: AgentEventPayload): PlatformProfile {
  return event.platform ?? { clientFamily: "unknown", confidence: 0, source: "agent" };
}

export function evaluateShadowObservation(event: AgentEventPayload): ShadowAssessment | null {
  if (event.type !== "movement" || !event.shadowObservation) return null;
  const observation = event.shadowObservation;
  const profile = profileForObservation(event);
  const deviation = observation.observedValue !== undefined && observation.expectedMax !== undefined
    ? Math.max(0, observation.observedValue - observation.expectedMax)
    : 0;
  const severity = Math.min(100, Math.round(deviation * 12));
  const sourceWeight = observation.measurementSource === "bds_authoritative" ? 40 : observation.measurementSource === "geyser_translated" ? 28 : 18;
  const quality = Math.min(100, sourceWeight + Math.min(30, observation.sampleCount * 3) + (observation.networkQuality === "stable" ? 20 : observation.networkQuality === "unknown" ? 8 : 0));
  const platformFit = profile.clientFamily === "unknown" ? 20 : profile.confidence >= 0.8 ? 85 : 55;
  const explained = observation.environmentFlags.some(flag => explanatoryEnvironment.has(flag)) || observation.serverEffects.length > 0;
  const uncertain = profile.clientFamily === "unknown" || observation.networkQuality !== "stable" || observation.sampleCount < 4;
  const status = explained || uncertain ? "suppressed" : "observed";
  const suppressionReason = explained
    ? "Çevre veya sunucu etkisi meşru hareket açıklaması sağlıyor; gölge modda bastırıldı."
    : uncertain
      ? "Platform/ölçüm bağlamı yaptırım için yetersiz; gölge modda bastırıldı."
      : undefined;
  return { candidateType: observation.candidateType, severity, evidenceQuality: quality, platformFit, status, suppressionReason, profile };
}
