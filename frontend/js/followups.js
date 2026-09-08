/**
 * SevaHealth - Follow-up and SMS Reminders Controller
 */

document.addEventListener("DOMContentLoaded", () => {
  loadFollowupsList();
});

async function loadFollowupsList() {
  const container = document.getElementById("followups-list-body");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE_URL}/followups`);
    if (!res.ok) throw new Error("Failed to load follow-ups");
    const followups = await res.json();

    if (followups.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--slate-500);">
            No upcoming follow-ups scheduled.
          </td>
        </tr>
      `;
      return;
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
          <td>${f.assigned_worker}</td>
          <td>
            <span class="badge ${isDue ? 'badge-warning' : 'badge-primary'}">${f.status}</span>
          </td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="sendDemoSmsReminder(${f.id})">
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

  } catch (e) {
    console.error("Followups load error:", e);
    container.innerHTML = `<tr><td colspan="7" class="text-danger" style="text-align:center;">Error loading follow-ups</td></tr>`;
  }
}

async function sendDemoSmsReminder(followupId) {
  try {
    const res = await fetch(`${API_BASE_URL}/followups/${followupId}/send-sms`, {
      method: "POST"
    });

    if (!res.ok) throw new Error("Failed to trigger SMS");
    const data = await res.json();

    // Show custom modal or alert with SMS preview
    const smsModal = document.getElementById("sms-preview-modal");
    if (smsModal) {
      document.getElementById("sms-phone-disp").textContent = data.recipient_phone;
      document.getElementById("sms-en-text").textContent = data.sms_preview_en;
      document.getElementById("sms-te-text").textContent = data.sms_preview_te;
      smsModal.style.display = "flex";
    } else {
      showToast(`📲 Demo SMS sent to ${data.recipient_phone}`);
    }

    loadFollowupsList();
  } catch (e) {
    showToast(`SMS failed: ${e.message}`, "danger");
  }
}

function closeSmsModal() {
  const smsModal = document.getElementById("sms-preview-modal");
  if (smsModal) smsModal.style.display = "none";
}

async function markFollowupCompleted(followupId) {
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
    showToast(`Error: ${e.message}`, "danger");
  }
}
