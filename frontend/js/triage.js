/**
 * SevaHealth - Client-Side Smart Triage Rule Engine
 * Evaluates vitals and symptoms locally in offline/online mode with transparent rules.
 */

function runLocalSmartTriage(vitals, symptoms) {
  const flags = (symptoms.emergency_flags || "").toLowerCase();
  const symptomsText = (symptoms.symptoms_text || "").toLowerCase();

  const redReasons = [];
  const yellowReasons = [];

  // 1. RED (Emergency) Criteria
  if (flags && (flags.includes("chest pain") || flags.includes("breathing") || flags.includes("unconscious") || flags.includes("bleeding") || flags.includes("seizure") || flags.includes("collapse"))) {
    redReasons.push("Emergency warning signs detected");
  }

  const spo2 = parseFloat(vitals.spo2);
  if (!isNaN(spo2) && spo2 < 90) {
    redReasons.push(`Critical Hypoxia (SpO2 ${spo2}% < 90%)`);
  }

  const sys = parseFloat(vitals.bp_systolic);
  const dia = parseFloat(vitals.bp_diastolic);
  if ((!isNaN(sys) && sys >= 180) || (!isNaN(dia) && dia >= 110)) {
    redReasons.push(`Hypertensive Crisis (BP ${sys || '--'}/${dia || '--'})`);
  }

  const hr = parseFloat(vitals.heart_rate);
  if (!isNaN(hr) && (hr > 130 || hr < 40)) {
    redReasons.push(`Critical Heart Rate (${hr} bpm)`);
  }

  const temp = parseFloat(vitals.temperature);
  if (!isNaN(temp) && temp >= 103.5) {
    redReasons.push(`Severe Hyperthermia / High Fever (${temp}°F)`);
  }

  if (redReasons.length > 0) {
    return {
      risk_level: "RED",
      risk_title: "RED — Emergency",
      badge_class: "badge-risk-red",
      rule_triggered: redReasons.join(" | "),
      action_recommended: "Immediate Medical Attention Required. Administer first-aid, prepare oxygen, and coordinate emergency referral / 108 Ambulance.",
      routed_to: "Emergency PHC / Specialist Attention",
      color: "#ef4444"
    };
  }

  // 2. YELLOW (Priority) Criteria
  if (!isNaN(spo2) && spo2 >= 90 && spo2 <= 94) {
    yellowReasons.push(`Moderate Oxygen Depletion (SpO2 ${spo2}%)`);
  }

  if ((!isNaN(sys) && sys >= 140 && sys < 180) || (!isNaN(dia) && dia >= 90 && dia < 110)) {
    yellowReasons.push(`Elevated Blood Pressure (BP ${sys || '--'}/${dia || '--'})`);
  }

  if (!isNaN(temp) && temp >= 100.4 && temp < 103.5) {
    yellowReasons.push(`Moderate/High Fever (${temp}°F)`);
  }

  if (!isNaN(hr) && hr >= 100 && hr <= 130) {
    yellowReasons.push(`Elevated Heart Rate (${hr} bpm)`);
  }

  const sugar = parseFloat(vitals.blood_sugar);
  if (!isNaN(sugar) && (sugar > 200 || sugar < 70)) {
    yellowReasons.push(`Abnormal Blood Glucose (${sugar} mg/dL)`);
  }

  const dur = parseInt(symptoms.duration_days, 10);
  if (!isNaN(dur) && dur >= 5) {
    yellowReasons.push(`Persistent Symptoms (${dur} days)`);
  }

  if (symptomsText.includes("chest") || symptomsText.includes("breath") || symptomsText.includes("dizzy") || symptomsText.includes("vomit")) {
    yellowReasons.push("Moderate clinical symptoms noted");
  }

  if (yellowReasons.length > 0) {
    return {
      risk_level: "YELLOW",
      risk_title: "YELLOW — Priority",
      badge_class: "badge-risk-yellow",
      rule_triggered: yellowReasons.join(" | "),
      action_recommended: "Add to Priority Doctor Queue for Tele-Consultation or PHC review within 24 hours.",
      routed_to: "Priority Doctor Queue",
      color: "#f59e0b"
    };
  }

  // 3. GREEN (Routine) Criteria
  return {
    risk_level: "GREEN",
    risk_title: "GREEN — Routine",
    badge_class: "badge-risk-green",
    rule_triggered: `Normal Vitals (SpO2 ${spo2 || 'Normal'}%, Temp ${temp || 'Normal'}°F, BP ${sys || 'Normal'}/${dia || 'Normal'})`,
    action_recommended: "Routine Follow-up & Home Care Guidance. Maintain hydration, oral rest, and follow-up if symptoms persist.",
    routed_to: "Routine Home Care",
    color: "#10b981"
  };
}

/**
 * Render visual Smart Triage result card
 */
function renderTriageCardHTML(result) {
  return `
    <div class="triage-result-card triage-result-${result.risk_level.toLowerCase()}">
      <div class="triage-header">
        <div class="triage-badge-pill ${result.badge_class}">
          ${result.risk_level === 'RED' ? '🚨' : (result.risk_level === 'YELLOW' ? '⚠️' : '✅')}
          <strong>${result.risk_title}</strong>
        </div>
        <span class="triage-dest-tag">${result.routed_to}</span>
      </div>
      
      <div class="triage-body">
        <div class="triage-row">
          <span class="triage-label">⚡ Trigger Rule:</span>
          <span class="triage-val">${result.rule_triggered}</span>
        </div>
        <div class="triage-row">
          <span class="triage-label">📋 Recommended Action:</span>
          <span class="triage-val">${result.action_recommended}</span>
        </div>
      </div>
      
      <div class="triage-footer-note">
        <small>💡 <em>Smart Triage Prototype Engine — Rule-Based Frontline Decision Support</em></small>
      </div>
    </div>
  `;
}
