// ==========================================

// SQUAD ROSTER INSPECTION MODAL LOGIC

// ==========================================

import { apiClient } from './api.js';


function closeRosterModal() {

  const modal = document.getElementById("roster-modal");

  if (modal) modal.style.display = "none";

}



document.addEventListener("click", (e) => {

  const modal = document.getElementById("roster-modal");

  if (!modal) return;



  if (e.target.closest("#close-roster-modal-btn") || e.target.closest("#roster-dismiss-btn")) {

    e.preventDefault();

    closeRosterModal();

  } else if (e.target === modal) {

    closeRosterModal();

  }

});



window.openSquadRoster = async function openSquadRoster(squadId) {

  const modal = document.getElementById("roster-modal");

  const rosterMembersListEl = document.getElementById("roster-members-list");

  const rosterTitleEl = document.getElementById("roster-squad-title");

  const rosterSlotBadgeEl = document.getElementById("roster-slot-badge");

  const rosterPitchEl = document.getElementById("roster-squad-pitch");

  const rosterHackathonEl = document.getElementById("roster-squad-hackathon");

  const rosterTechEl = document.getElementById("roster-squad-tech");



  if (!modal || !rosterMembersListEl) return;



  // Open modal in loading state

  modal.style.display = "flex";

  if (rosterTitleEl) rosterTitleEl.textContent = "SYNCHRONIZING SQUAD...";

  if (rosterSlotBadgeEl) rosterSlotBadgeEl.textContent = "--/--";

  if (rosterPitchEl) rosterPitchEl.textContent = "";

  if (rosterHackathonEl) rosterHackathonEl.textContent = "";

  if (rosterTechEl) rosterTechEl.innerHTML = "";



  rosterMembersListEl.innerHTML = `

    <div style="text-align: center; padding: 2.5rem 0; color: #71717a; font-family: monospace; font-size: 0.8rem;">

      // ESTABLISHING UPLINK TO ROSTER TELEMETRY...

    </div>

  `;

  try {

    const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000/api'
      : 'https://collabforge-o7db.onrender.com/api';

    const res = await fetch(`${API_BASE_URL}/squads/${squadId}/roster`);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    const data = await res.json();    


    // 1. Populate Squad Header from real backend data

    if (rosterTitleEl) rosterTitleEl.textContent = data.squad_name;

    if (rosterSlotBadgeEl) rosterSlotBadgeEl.textContent = `${data.current_count}/${data.max_members} SLOTS`;

    if (rosterHackathonEl) rosterHackathonEl.textContent = data.hackathon || "TARGET HACKATHON";

    if (rosterPitchEl) rosterPitchEl.textContent = data.pitch || "No mission brief filed.";



    if (rosterTechEl) {

      rosterTechEl.innerHTML = (data.tech_stack || [])

        .map(tag => `<span class="tech-tag">${tag}</span>`)

        .join("");

    }



    // 2. Render Deployed Operatives & Open Slots

    renderRosterList(data);

  } catch (err) {

    console.error("[Roster Error]", err);

    rosterMembersListEl.innerHTML = `

      <div style="text-align: center; padding: 2rem; color: #ef4444; font-family: monospace; font-size: 0.75rem; border: 1px solid rgba(127, 29, 29, 0.6); border-radius: 6px; background: rgba(69, 10, 10, 0.2);">

        // FAILED TO LOAD SQUAD TELEMETRY //

      </div>

    `;

  }

// 1. Kick Member Listener (Leader Action: /roles/{role_index}/vacate)
rosterMembersListEl.querySelectorAll('.btn-kick-member').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const squadId = btn.getAttribute('data-squad-id');
    const roleIndex = btn.getAttribute('data-role-index');

    if (!confirm("Are you sure you want to remove this operative from the squad?")) return;

    btn.disabled = true;
    btn.textContent = "Removing...";

    try {
      const token = await window.auth.currentUser.getIdToken();
      
      const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8000/api'
        : 'https://collabforge-o7db.onrender.com/api';

      const res = await fetch(`${API_BASE_URL}/squads/${squadId}/roles/${roleIndex}/vacate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to vacate role`);

        // Refresh the roster view live
        window.openSquadRoster(squadId);
      } catch (err) {
        console.error('[CollabForge] Error vacating member:', err);
        alert(`Failed to kick member: ${err.message}`);
        btn.disabled = false;
        btn.textContent = "Kick ✕";
      }
    });
  });

  // 2. Leave Squad Listener (Member Action: /leave-role/{role_index})
rosterMembersListEl.querySelectorAll('.btn-leave-squad').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const squadId = btn.getAttribute('data-squad-id');
    const roleIndex = btn.getAttribute('data-role-index');

    if (!confirm("Are you sure you want to leave this squad?")) return;

    btn.disabled = true;
    btn.textContent = "Leaving...";

    try {
      const token = await window.auth.currentUser.getIdToken();

      const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8000/api'
        : 'https://collabforge-o7db.onrender.com/api';

      const res = await fetch(`${API_BASE_URL}/squads/${squadId}/leave-role/${roleIndex}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to leave squad`);

        // Close roster modal after leaving
        const modal = document.getElementById("roster-modal");
        if (modal) {
          modal.style.setProperty("display", "none", "important");
          modal.style.setProperty("opacity", "0", "important");
          modal.style.setProperty("visibility", "hidden", "important");
        }
        alert("You have left the squad.");
      } catch (err) {
        console.error('[CollabForge] Error leaving squad:', err);
        alert(`Failed to leave squad: ${err.message}`);
        btn.disabled = false;
        btn.textContent = "Leave ⤶";
      }
    });
  });
}



function renderRosterList(data) {
  const rosterMembersListEl = document.getElementById("roster-members-list");
  if (!rosterMembersListEl) return;
  rosterMembersListEl.innerHTML = "";

  const currentUid = window.auth?.currentUser?.uid;
  // Fallback: check data.is_leader, OR compare leader_id against currently logged-in UID
  const isLeaderViewing = Boolean(data.is_leader || (data.leader_id && data.leader_id === currentUid));

  // 1. Render Active Members Returned by FastAPI
  (data.members || []).forEach((member, index) => {
    const isMemberLeader = Boolean(member.is_leader || (data.leader_id && member.uid === data.leader_id));
    const isMemberSelf = member.uid === currentUid;
    const roleIndex = member.role_index ?? member.index ?? index;

    const skillsHtml = (member.primary_skills || []).length
      ? member.primary_skills
          .slice(0, 4)
          .map((skill) => `<span class="tech-tag">${skill}</span>`)
          .join(" ")
      : `<span style="font-size: 0.65rem; font-family: monospace; color: #52525b;">NO SKILLS DECLARED</span>`;

    const initials = (member.display_name || "OP").slice(0, 2).toUpperCase();

    const card = document.createElement("div");
    card.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.75rem; border-radius: 8px;
      border: 1px solid ${isMemberLeader ? "rgba(185, 28, 28, 0.4)" : "rgba(255, 255, 255, 0.08)"};
      background: ${isMemberLeader ? "rgba(127, 29, 29, 0.1)" : "rgba(24, 24, 27, 0.5)"};
      transition: border-color 0.15s;
    `;

    // Leader can kick any non-leader operative
    const showKickBtn = isLeaderViewing && !isMemberLeader;
    // Operative can leave if this card is their own account and they are not the leader
    const showLeaveBtn = !isMemberLeader && isMemberSelf;

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem; min-width: 0;">
        <div style="width: 38px; height: 38px; border-radius: 50%; background: #27272a; border: 1px solid ${
          isMemberLeader ? "rgba(239, 68, 68, 0.6)" : "#3f3f46"
        }; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.75rem; color: #f4f4f5; flex-shrink: 0; overflow: hidden;">
          ${
            member.avatar_url
              ? `<img src="${member.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;" />`
              : initials
          }
        </div>
        <div style="min-width: 0;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-weight: 600; font-size: 0.88rem; color: #f4f4f5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${member.display_name}
            </span>
            ${
              isMemberLeader
                ? `<span style="font-size: 0.6rem; font-family: monospace; padding: 0.05rem 0.4rem; border-radius: 2px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171;">LEAD</span>`
                : `<span style="font-size: 0.6rem; font-family: monospace; padding: 0.05rem 0.4rem; border-radius: 2px; background: #27272a; color: #a1a1aa;">OPERATIVE</span>`
            }
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.35rem;">
            ${skillsHtml}
          </div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0;">
        <button 
          type="button"
          onclick="if(window.openOperativeDossier) window.openOperativeDossier('${member.uid}')" 
          style="font-size: 0.72rem; font-family: monospace; padding: 0.35rem 0.65rem; border-radius: 4px; background: #18181b; border: 1px solid rgba(255, 255, 255, 0.1); color: #a1a1aa; cursor: pointer;">
          Dossier →
        </button>

        ${
          showKickBtn
            ? `<button 
                type="button" 
                class="btn-kick-member"
                data-squad-id="${data.squad_id || data.id}" 
                data-role-index="${roleIndex}" 
                style="font-size: 0.72rem; font-family: monospace; padding: 0.35rem 0.6rem; border-radius: 4px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; cursor: pointer;">
                Kick ✕
              </button>`
            : ""
        }

        ${
          showLeaveBtn
            ? `<button 
                type="button" 
                class="btn-leave-squad"
                data-squad-id="${data.squad_id || data.id}" 
                data-role-index="${roleIndex}"
                style="font-size: 0.72rem; font-family: monospace; padding: 0.35rem 0.6rem; border-radius: 4px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; cursor: pointer;">
                Leave ⤶
              </button>`
            : ""
        }
      </div>
    `;

    rosterMembersListEl.appendChild(card);
  });

  // 2. Render Exact Vacancies Configured by the Leader
  if (data.open_roles && data.open_roles.length > 0) {
    data.open_roles.forEach((roleTitle) => {
      const slotCard = document.createElement("div");
      slotCard.style.cssText = `
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.75rem; border-radius: 8px;
        border: 1px dashed rgba(255, 255, 255, 0.12);
        background: rgba(9, 9, 11, 0.4);
      `;

      slotCard.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="width: 38px; height: 38px; border-radius: 50%; border: 1px dashed #3f3f46; display: flex; align-items: center; justify-content: center; font-family: monospace; font-size: 0.85rem; color: #71717a;">
            +
          </div>
          <div>
            <span style="font-family: monospace; font-size: 0.78rem; color: #a1a1aa; text-transform: uppercase;">
              [VACANT] ${roleTitle}
            </span>
            <p style="font-size: 0.68rem; color: #52525b; font-family: monospace; margin-top: 0.15rem;">Awaiting candidate application</p>
          </div>
        </div>
      `;
      rosterMembersListEl.appendChild(slotCard);
    });
  } else if (!data.open_slots_count || data.open_slots_count === 0) {
    const fullNotice = document.createElement("div");
    fullNotice.style.cssText = `
      text-align: center; padding: 0.85rem;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px; background: rgba(255, 255, 255, 0.02);
      color: #71717a; font-family: monospace; font-size: 0.72rem;
    `;
    fullNotice.textContent = "// SQUAD IS FULLY MANNED - NO VACANCIES //";
    rosterMembersListEl.appendChild(fullNotice);
  }

  // 3. Event Listeners for Kick & Leave buttons
rosterMembersListEl.querySelectorAll('.btn-kick-member').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const squadId = btn.getAttribute('data-squad-id');
    const roleIndex = btn.getAttribute('data-role-index');

    if (!confirm("Are you sure you want to remove this operative from the squad?")) return;

    btn.disabled = true;
    btn.textContent = "...";

    try {
      const token = await window.auth.currentUser.getIdToken();

      const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8000/api'
        : 'https://collabforge-o7db.onrender.com/api';

      const res = await fetch(`${API_BASE_URL}/squads/${squadId}/roles/${roleIndex}/vacate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        window.openSquadRoster(squadId);
      } catch (err) {
        console.error('Failed to kick member:', err);
        alert('Failed to remove operative.');
        btn.disabled = false;
        btn.textContent = "Kick ✕";
      }
    });
  });

  rosterMembersListEl.querySelectorAll('.btn-leave-squad').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const squadId = btn.getAttribute('data-squad-id');
      const roleIndex = btn.getAttribute('data-role-index');

      if (!confirm("Are you sure you want to leave this squad?")) return;

      btn.disabled = true;
      btn.textContent = "...";

      try {
        const token = await window.auth.currentUser.getIdToken();
        const res = await fetch(`http://localhost:8000/api/squads/${squadId}/leave-role/${roleIndex}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const modal = document.getElementById("roster-modal");
        if (modal) {
          modal.style.setProperty("display", "none", "important");
          modal.style.setProperty("visibility", "hidden", "important");
        }
        alert("You have left the squad.");
      } catch (err) {
        console.error('Failed to leave squad:', err);
        alert('Failed to leave squad.');
        btn.disabled = false;
        btn.textContent = "Leave ⤶";
      }
    });
  });
} 

//Dosseir Profile
window.openOperativeDossier = async function (uid) {
  const modal = document.getElementById("public-dossier-modal");
  const nameEl = document.getElementById("dossier-public-name");
  const bioEl = document.getElementById("dossier-public-bio");
  const skillsEl = document.getElementById("dossier-public-skills");
  const githubLink = document.getElementById("dossier-public-github");
  const portfolioLink = document.getElementById("dossier-public-portfolio");
  const badgesContainer = document.getElementById("dossier-public-badges");

  if (!modal) {
    console.error("[CollabForge] Missing #public-dossier-modal in markup.");
    return;
  }

  // Display the modal with a loading state
  modal.style.display = "flex";
  if (nameEl) nameEl.textContent = "DECRYPTING DOSSIER...";
  if (bioEl) bioEl.textContent = "Loading operative telemetry...";
  if (skillsEl) skillsEl.innerHTML = "";
  if (badgesContainer) badgesContainer.innerHTML = "";

  try {
    const res = await fetch(`http://127.0.0.1:8000/api/users/${uid}/profile`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load dossier`);

    const data = await res.json();

    // Populate profile data
    if (nameEl) nameEl.textContent = data.display_name || "Anonymous Operative";
    if (bioEl) bioEl.textContent = data.bio || "No operative background statement recorded.";

    // Skills badges
    if (skillsEl) {
      skillsEl.innerHTML = (data.primary_skills || [])
        .map(s => `<span style="font-size: 0.7rem; font-family: monospace; padding: 0.2rem 0.5rem; background: #18181b; border: 1px solid #27272a; border-radius: 4px; color: #d4d4d8;">${s}</span>`)
        .join("");
    }

    // Links
    if (githubLink) {
      githubLink.href = data.github_url || "#";
      githubLink.style.display = data.github_url ? "inline-flex" : "none";
    }
    if (portfolioLink) {
      portfolioLink.href = data.portfolio_url || "#";
      portfolioLink.style.display = data.portfolio_url ? "inline-flex" : "none";
    }

    // Render achievements/badges
    if (badgesContainer && Array.isArray(data.achievements)) {
      badgesContainer.innerHTML = data.achievements.map(ach => `
        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;">
          ${ach.image_url ? `<img src="${ach.image_url}" style="width: 20px; height: 20px; border-radius: 3px;" />` : ''}
          <span style="font-size: 0.75rem; color: #fff; font-weight: 600;">${ach.title}</span>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error("[Dossier Error]:", err);
    if (bioEl) bioEl.textContent = `Telemetry unavailable: ${err.message}`;
  }
};

// Dossier Profile fetch
window.openOperativeDossier = async function (userId) {
  const modal = document.getElementById("public-dossier-modal");
  const nameEl = document.getElementById("dossier-public-name");
  const bioEl = document.getElementById("dossier-public-bio");
  const skillsEl = document.getElementById("dossier-public-skills");
  const githubLink = document.getElementById("dossier-public-github");
  const portfolioLink = document.getElementById("dossier-public-portfolio");
  const badgesContainer = document.getElementById("dossier-public-badges");

  if (!modal) {
    console.error("[CollabForge] #public-dossier-modal missing from DOM.");
    return;
  }

  // 1. Loading State
  modal.style.display = "flex";
  if (nameEl) {
    nameEl.textContent = "DECRYPTING DOSSIER...";
    nameEl.classList.add("hackathon-wave");
  }
  if (bioEl) bioEl.textContent = "Querying operative telemetry...";
  if (skillsEl) skillsEl.innerHTML = "";
  if (badgesContainer) badgesContainer.innerHTML = "";

  try {
    // 2. Fetch via apiClient (already handles status check and JSON parsing)
    const data = await apiClient.getUserProfile(userId);

    // 3. Populate Fields
    if (nameEl) {
      nameEl.textContent = data.display_name || data.name || data.handle || "Anonymous Operative";
      nameEl.classList.remove("hackathon-wave");
    }

    if (bioEl) {
      bioEl.textContent = data.bio || "No operative background statement recorded.";
    }

    // Disciplines / Skills
    const skills = data.primary_skills || data.skills || [];
    if (skillsEl) {
      skillsEl.innerHTML = skills.length
        ? skills.map(s => `<span class="tech-tag" style="font-size: 0.7rem; font-family: monospace; padding: 0.2rem 0.5rem; background: #18181b; border: 1px solid #27272a; border-radius: 4px; color: #d4d4d8;">${s}</span>`).join("")
        : `<span style="font-size: 0.72rem; color: #52525b; font-family: monospace;">NO SKILLS DECLARED</span>`;
    }

    // External Profiles
    if (githubLink) {
      githubLink.href = data.github_url || "#";
      githubLink.style.display = data.github_url ? "inline-flex" : "none";
    }
    if (portfolioLink) {
      portfolioLink.href = data.portfolio_url || data.linkedin_url || "#";
      portfolioLink.style.display = (data.portfolio_url || data.linkedin_url) ? "inline-flex" : "none";
    }

    // Badges / Achievements
    const achievements = data.achievements || [];
    if (badgesContainer) {
      badgesContainer.innerHTML = achievements.length
        ? achievements.map(ach => `
            <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;">
              ${ach.image_url ? `<img src="${ach.image_url}" style="width: 20px; height: 20px; border-radius: 3px;" />` : ''}
              <span style="font-size: 0.75rem; color: #fff; font-weight: 600;">${ach.title}</span>
            </div>
          `).join('')
        : `<span style="font-size: 0.72rem; color: #52525b; font-family: monospace;">NO BADGES RECORDED</span>`;
    }

  } catch (err) {
    console.error("[Dossier Telemetry Error]:", err);
    if (nameEl) nameEl.textContent = "DOSSIER OFFLINE";
    if (bioEl) bioEl.textContent = `Could not retrieve profile: ${err.message}`;
  }
};

document.addEventListener("click", (e) => {
  const rosterModal = document.getElementById("roster-modal");
  const dossierModal = document.getElementById("public-dossier-modal");

  // Roster dismissal
  if (rosterModal && (e.target.closest("#close-roster-modal-btn") || e.target.closest("#roster-dismiss-btn") || e.target === rosterModal)) {
    rosterModal.style.display = "none";
  }

  // Dossier dismissal (clicking backdrop)
  if (dossierModal && e.target === dossierModal) {
    dossierModal.style.display = "none";
  }
});

// Open Edit Squad Modal and prefill existing data
window.openEditSquadModal = async function openEditSquadModal(squadId) {
  const modal = document.getElementById("edit-squad-modal");
  if (!modal) return;

  const idInput = document.getElementById("edit-squad-id");
  const nameInput = document.getElementById("edit-squad-name");
  const hackathonInput = document.getElementById("edit-squad-hackathon");
  const pitchInput = document.getElementById("edit-squad-pitch");
  const techInput = document.getElementById("edit-squad-tech");
  const waveTitleEl = document.getElementById("edit-squad-hackathon-wave");

  // Show modal immediately
  modal.style.display = "flex";

  // Temporary loading placeholders
  idInput.value = squadId;
  nameInput.value = "Loading...";
  hackathonInput.value = "Loading...";
  pitchInput.value = "Loading...";
  techInput.value = "Loading...";
  if (waveTitleEl) {
    waveTitleEl.textContent = "SYNCING...";
  }

  try {
    const res = await fetch(`http://127.0.0.1:8000/api/squads/${squadId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch squad`);

    const squad = await res.json();

    // Populate inputs with existing data
    nameInput.value = squad.name || squad.title || "";
    hackathonInput.value = squad.hackathon || squad.hackathon_name || "";
    pitchInput.value = squad.pitch || squad.description || "";
    techInput.value = (squad.tech_stack || squad.skills || []).join(", ");

    // Set hackathon banner text
    if (waveTitleEl) {
      waveTitleEl.textContent = (squad.hackathon || squad.hackathon_name || "PARAMETERS").toUpperCase();
    }

    // Live reflection as user types in target hackathon
    hackathonInput.oninput = () => {
      if (waveTitleEl) {
        waveTitleEl.textContent = (hackathonInput.value.trim() || "PARAMETERS").toUpperCase();
      }
    };
  } catch (err) {
    console.error("[Edit Squad] Error loading data:", err);
    alert("Failed to load squad parameters.");
    modal.style.display = "none";
  }
};

// Close Edit Squad Modal helper
window.closeEditSquadModal = function closeEditSquadModal() {
  const modal = document.getElementById("edit-squad-modal");
  if (modal) {
    modal.style.display = "none";
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // Save Changes Handler
  const saveBtn = document.getElementById("btn-save-edit-squad");
  if (saveBtn) {
    saveBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const squadId = document.getElementById("edit-squad-id").value;
      const name = document.getElementById("edit-squad-name").value.trim();
      const hackathon = document.getElementById("edit-squad-hackathon").value.trim();
      const pitch = document.getElementById("edit-squad-pitch").value.trim();
      const techRaw = document.getElementById("edit-squad-tech").value.trim();

      if (!squadId) {
        alert("Missing squad ID.");
        return;
      }

      if (!name) {
        alert("Squad name cannot be empty.");
        return;
      }

      const techStack = techRaw
        ? techRaw.split(",").map((t) => t.trim()).filter(Boolean)
        : [];

      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      try {
        const token = await window.auth.currentUser.getIdToken();

        const payload = {
          name: name,
          hackathon: hackathon,
          pitch: pitch,
          tech_stack: techStack
        };

        const res = await fetch(`http://127.0.0.1:8000/api/squads/${squadId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `HTTP ${res.status}`);
        }

        window.closeEditSquadModal();

        if (typeof window.getMySquads === "function") {
          window.getMySquads();
        }
        if (typeof window.loadSquads === "function") {
          window.loadSquads();
        }

        alert("Squad parameters successfully updated.");
      } catch (err) {
        console.error("[Edit Squad] Save failed:", err);
        alert(`Failed to save changes: ${err.message}`);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Changes";
      }
    });
  }

  // Wire close and cancel buttons
  const closeBtn = document.getElementById("btn-close-edit-squad-modal");
  const cancelBtn = document.getElementById("btn-cancel-edit-squad");

  if (closeBtn) closeBtn.addEventListener("click", window.closeEditSquadModal);
  if (cancelBtn) cancelBtn.addEventListener("click", window.closeEditSquadModal);
});

// Handle Delete / Disband Squad
  const deleteBtn = document.getElementById("btn-delete-squad");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const squadId = document.getElementById("edit-squad-id").value;
      const squadName = document.getElementById("edit-squad-name").value || "this squad";

      if (!squadId) {
        alert("Missing squad ID.");
        return;
      }

      // Safeguard Confirmation Prompt
      const confirmation = prompt(
        `DANGER: You are about to permanently disband "${squadName}".\n\nAll roles and active applications will be invalidated.\n\nType "DISBAND" to confirm:`
      );

      if (confirmation !== "DISBAND") {
        if (confirmation !== null) {
          alert("Action aborted. Confirmation keyword did not match.");
        }
        return;
      }

      deleteBtn.disabled = true;
      deleteBtn.innerHTML = `<span>TERMINATING...</span>`;

      try {
        const token = await window.auth.currentUser.getIdToken();

        const res = await fetch(`http://127.0.0.1:8000/api/squads/${squadId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `HTTP ${res.status}`);
        }

        // Close edit modal
        window.closeEditSquadModal();

        // Refresh squads modal list and global listings if active
        const btnMySquadsMenu = document.getElementById("menu-my-squads");
        if (btnMySquadsMenu) {
          btnMySquadsMenu.click();
        }
        if (typeof window.loadSquads === "function") {
          window.loadSquads();
        }

        // Decrement profile dropdown squads counter dynamically
        const squadCounterEl = document.getElementById("counter-my-squads");
        if (squadCounterEl) {
          const currentCount = parseInt(squadCounterEl.textContent, 10);
          if (!isNaN(currentCount) && currentCount > 0) {
            squadCounterEl.textContent = `${currentCount - 1} Total`;
          }
        }

        alert("Squad successfully disbanded and removed.");
      } catch (err) {
        console.error("[Disband Squad] Error:", err);
        alert(`Failed to disband squad: ${err.message}`);
      } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `<span>⚠ DISBAND SQUAD</span>`;
      }
    });
  }