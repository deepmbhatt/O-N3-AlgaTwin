const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const anomalyRank = { normal: 0, mild: 1, moderate: 2, high: 3, severe: 3 };

export function deriveVisualState(snapshot, options = {}) {
  const dashboard = snapshot.dashboard;
  const iot = snapshot.iot;
  const health = clamp((options.health ?? dashboard.health_score) / 100);
  const turbidity = clamp(dashboard.turbidity / 90);
  const chlorophyll = clamp(dashboard.chlorophyll_a / 70);
  const oxygen = clamp((iot.do_mg_l - 2) / 7);
  const temperature = clamp((iot.water_temp_avg_c - 18) / 20);
  const uptake = clamp(dashboard.gross_co2_uptake_rate_g_l_h / 0.006);
  const co2Ppm = Number.isFinite(Number(iot.co2_ppm)) && Number(iot.co2_ppm) > 0 ? Number(iot.co2_ppm) : 400;
  const co2Level = clamp((co2Ppm - 300) / 900);
  const gasIntensity = clamp(co2Level * .78 + uptake * .22);
  const warningSeverity = anomalyRank[dashboard.anomaly_severity] ?? 0;
  const healthMode = health >= 0.8 ? 'healthy' : health >= 0.5 ? 'stressed' : 'critical';
  const recovering = options.recovering || snapshot.label === 'Recovery';

  return {
    healthMode,
    health,
    recovering,
    algaeHue: Math.round(68 + health * 60 - turbidity * 18),
    algaeSaturation: Math.round(32 + chlorophyll * 34),
    algaeLightness: Math.round(31 + health * 17),
    waterOpacity: 0.46 + turbidity * 0.34,
    fishActivity: clamp(oxygen * 0.75 + health * 0.25),
    butterflyDensity: clamp((health - 0.28) * 1.5),
    oxygenBubbleRate: oxygen,
    co2Ppm,
    gasIntensity,
    gasBubbleCount: Math.round(4 + gasIntensity * 16),
    gasBubbleScale: 0.72 + gasIntensity * 0.72,
    co2ParticleRate: clamp(.45 + gasIntensity * .75),
    sunStrength: 0.45 + temperature * 0.55,
    haze: clamp((temperature - 0.65) * 2.2),
    warningSeverity,
    warningColor: warningSeverity >= 3 ? '#be5a3f' : warningSeverity >= 1 ? '#d79a4a' : '#66ad8a',
    mascotMood: recovering ? 'hopeful' : warningSeverity >= 3 || health < 0.5 ? 'worried' : warningSeverity >= 1 || health < 0.78 ? 'concerned' : 'calm',
    animationSpeed: 0.72 + health * 0.55,
  };
}

export function visualCssVars(visual) {
  return {
    '--health': visual.health,
    '--algae-h': visual.algaeHue,
    '--algae-s': `${visual.algaeSaturation}%`,
    '--algae-l': `${visual.algaeLightness}%`,
    '--water-opacity': visual.waterOpacity,
    '--fish-activity': Math.max(0.18, visual.fishActivity),
    '--butterfly-density': visual.butterflyDensity,
    '--bubble-rate': Math.max(0.16, visual.oxygenBubbleRate),
    '--co2-rate': Math.max(0.16, visual.co2ParticleRate),
    '--gas-density': visual.gasIntensity,
    '--gas-scale': visual.gasBubbleScale,
    '--sun-strength': visual.sunStrength,
    '--haze': visual.haze,
    '--warning': visual.warningColor,
    '--warning-level': visual.warningSeverity / 3,
    '--motion': visual.animationSpeed,
  };
}
