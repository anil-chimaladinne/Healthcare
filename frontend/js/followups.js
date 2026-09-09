/**
 * SevaHealth - Follow-up and SMS Reminders Controller
 * Offline-first support with local bilingual SMS preview engine.
 */

document.addEventListener("DOMContentLoaded", () => {
  loadFollowupsList();
});

async function loadFollowupsList() {
  const container = document.getElementById("followups-list-body");
  if (!container) return;

  let followups = [];

  if (typeof isAppOnline === "function" && isAppOnline()) {
    try {
      const res = await fetch(`${API_BASE_URL}/followups`);
      if (res.ok) {
        followups = await res.json();
      } else if (typeof getLocalFollowups === "function") {
        followups = await getLocalFollowups();
      }
    } catch (e) {
      if (typeof getLocalFollowups === "function") {
        followups = await getLocalFollowups();
      }
    }
  } else if (typeof getLocalFollowups === "function") {
    followups = await getLocalFollowups();
  }

  if (!followups || followups.length === 0) {
    followups = [
      {
        id: 1,
        patient_id: "SEVA-000001",
        patient_name: "Lakshmi Devi",
        phone: "+91 98765 43210",
        reason: "Post-hypertension blood pressure review and medication adherence",
        due_date: "2026-09-12",
        assigned_worker: "Anitha Rao (ASHA)",
        status: "Due",
        sms_reminder_sent: 0
      },
      {
        id: 2,
        patient_id: "SEVA-000002",
        patient_name: "Ramesh Reddy",
        phone: "+91 98480 12345",
        reason: "Day-3 high fever follow-up & rapid malaria/dengue test verification",
        due_date: "2026-09-11",
        assigned_worker: "Anitha Rao (ASHA)",
        status: "Due",
        sms_reminder_sent: 0
      }
    ];
  }

  container.innerHTML = followups.map((f) => {
    const isDue = f.status === 'Due';
    return `
      <tr>
        <td>
          <strong>${f.patient_name}</strong><br>
          <small class="code-font">${f.patient_id}</small>
        </td>
        <td>${f.reason}</td>
        <td><strong>📅 ${f.due_date}</strong></td>
        <td>${f.assigned_worker || 'Frontline Health Worker'}</td>
        <td>
          <span class="badge ${isDue ? 'badge-warning' : 'badge-primary'}">${f.status}</span>
        </td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="sendDemoSmsReminder(${f.id}, '${f.patient_name}', '${f.due_date}', '${f.phone || '+91 98765 43210'}')">
            📲 ${f.sms_reminder_sent ? 'Re-send SMS' : 'Send Demo SMS'}
          </button>
        </td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="markFollowupCompleted(${f.id})" ${f.status === 'Completed' ? 'disabled' : ''}>
            ${f.status === 'Completed' ? '✓ Completed' : 'Mark Done'}
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

async function sendDemoSmsReminder(followupId, patientName = "Patient", dueDate = "Upcoming", phone = "+91 98765 43210") {
  if (typeof isAppOnline === "function" && isAppOnline()) {
    try {
      const res = await fetch(`${API_BASE_URL}/followups/${followupId}/send-sms`, {
        method: "POST"
      });

      if (res.ok) {
        const data = await res.json();
        showSmsModal(data.recipient_phone, data.sms_preview_en, data.sms_preview_te);
        loadFollowupsList();
        return;
      }
    } catch (e) {
      console.warn("SMS online trigger failed, rendering offline preview:", e);
    }
  }

  // Offline bilingual SMS generator
  const smsEn = `Namaste ${patientName}, your health follow-up visit with SevaHealth ASHA worker is scheduled for ${dueDate}. Please keep your health card ready. Stay hydrated.`;
  const smsTe = `నమస్కారం ${patientName} గారు, మీ ఆరోగ్య తనిఖీ కోసం సేవాహెల్త్ ఆశా కార్యకర్త దర్శనం ${dueDate} నాడు ఏర్పాటు చేయబడింది. దయచేసి మీ హెల్త్ కార్డు సిద్ధంగా ఉంచుకోండి.`;
  
  showSmsModal(phone, smsEn, smsTe);
}

function showSmsModal(phone, enText, teText) {
  const smsModal = document.getElementById("sms-preview-modal");
  if (smsModal) {
    document.getElementById("sms-phone-disp").textContent = phone;
    document.getElementById("sms-en-text").textContent = enText;
    document.getElementById("sms-te-text").textContent = teText;
    smsModal.style.display = "flex";
  } else {
    showToast(`📲 Demo SMS sent to ${phone}`);
  }
}

function closeSmsModal() {
  const smsModal = document.getElementById("sms-preview-modal");
  if (smsModal) smsModal.style.display = "none";
}

async function markFollowupCompleted(followupId) {
  if (typeof isAppOnline === "function" && !isAppOnline()) {
    if (typeof queueOfflineRecord === "function") {
      await queueOfflineRecord("followup_status", { followup_id: followupId, status: "Completed" });
    }
    showToast("✅ Follow-up marked as Completed (Offline Mode)! Will sync when connected.");
    loadFollowupsList();
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/followups/${followupId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Completed" })
    });

    if (!res.ok) throw new Error("Failed to complete follow-up");
    showToast("✅ Follow-up marked as Completed!");
    loadFollowupsList();
  } catch (e) {
    if (typeof queueOfflineRecord === "function") {
      await queueOfflineRecord("followup_status", { followup_id: followupId, status: "Completed" });
    }
    showToast("✅ Follow-up marked as Completed locally.");
    loadFollowupsList();
  }
}
