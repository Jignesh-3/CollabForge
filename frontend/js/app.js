/**
 * CollabForge — Dynamic State & FastAPI Integration Engine
 */
import { apiClient } from './api.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Ensure Firebase is initialized 
const firebaseConfig = {
  apiKey: "AIzaSyAGuTfavc-ibPGMkKohDovt0bemubnP1L8",
  authDomain: "collabforge-aaf25.firebaseapp.com",
  projectId: "collabforge-aaf25",
  storageBucket: "collabforge-aaf25.firebasestorage.app",
  messagingSenderId: "905009470237",
  appId: "1:905009470237:web:db13c873d63cbde07b9ff4"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
window.auth = auth;
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();


(function initCollabForgeEngine() {
  // DOM Elements - Modals
  const authModal = document.getElementById('auth-modal');
  const authCloseBtn = document.getElementById('modal-close-btn');
  const authTitle = document.getElementById('auth-gate-title');
  const authDesc = document.getElementById('auth-gate-desc');

  const pitchModal = document.getElementById('pitch-modal');
  const pitchCloseBtn = document.getElementById('pitch-modal-close');
  const pitchHackathonBadge = document.getElementById('pitch-hackathon-badge');
  const pitchSquadTitle = document.getElementById('pitch-squad-title');
  const pitchRoleSelect = document.getElementById('pitch-role-select');
  const pitchText = document.getElementById('pitch-text');
  const pitchCounter = document.getElementById('pitch-counter');
  const pitchForm = document.getElementById('pitch-form');
  const pitchProofUrl = document.getElementById('pitch-proof-url');
  const pitchAttachProfile = document.getElementById('pitch-attach-profile');

  const createSquadModal = document.getElementById('create-squad-modal');
  const createSquadCloseBtn = document.getElementById('create-modal-close');
  const createSquadForm = document.getElementById('create-squad-form');
  const rolesContainer = document.getElementById('roles-container');
  const btnAddRoleRow = document.getElementById('btn-add-role-row');

  // DOM Elements - Feed & Grid
  const squadGrid = document.querySelector('.squad-grid');
  const btnFilterVacant = document.getElementById('tab-filter-vacant');
  const btnFilterAll = document.getElementById('tab-filter-all');

  // DOM Elements - Auth & Header
  const btnSignIn = document.getElementById('btn-header-signin');
  const btnCreateGuest = document.getElementById('btn-header-create');
  const btnCreateUser = document.getElementById('btn-user-create');
  const guestControls = document.getElementById('guest-controls');
  const userControls = document.getElementById('user-controls');
  const profileTrigger = document.getElementById('profile-trigger');
  const profileDropdown = document.getElementById('profile-dropdown');
  const btnSignOut = document.getElementById('btn-sign-out');
  const btnGithub = document.getElementById('btn-oauth-github');
  const btnGoogle = document.getElementById('btn-oauth-google');

  // Active Session State
  let currentUser = null;
  let currentSquadsCache = [];
  let selectedSquadForPitch = null;

  // ==========================================
// 1. DYNAMIC HTML TEMPLATE FOR SQUAD CARDS
// ==========================================
function renderSquadCardHTML(squad) {
  // Support both raw roles and roles_needed conventions
  const roles = squad.roles || squad.roles_needed || [];

  // Calculate vacancy dynamically
  const vacantCount = typeof squad.vacant_count === 'number'
    ? squad.vacant_count
    : typeof squad.open_slots_count === 'number'
      ? squad.open_slots_count
      : roles.filter(r => {
          if (typeof r === 'string') return true; // Plain role strings are inherently open slots
          if (r.status) return r.status.toLowerCase() === 'vacant' || r.status.toLowerCase() === 'open';
          if (typeof r.is_filled === 'boolean') return !r.is_filled;
          if (typeof r.claimed === 'boolean') return !r.claimed;
          return true;
        }).length;

  // Check squad status
  const squadStatus = (squad.status || '').toLowerCase();
  const isLocked = squadStatus === 'locked' || squadStatus === 'full' || (roles.length > 0 && vacantCount === 0);

  // Fallbacks for Hackathon metadata
  const hackathonTitle = squad.hackathon || squad.hackathon_name || squad.target_hackathon || 'GLOBAL ARENA 2026';

  // Tech stack pills
  const techBadges = (squad.tech_stack || squad.techStack || squad.skills || [])
    .map(tag => `<span class="tech-tag">${tag}</span>`)
    .join('');

  const totalRolesCount = squad.total_roles || squad.max_members || (typeof squad.current_count === 'number' ? squad.current_count + vacantCount : roles.length);

  return `
    <article class="squad-card" data-squad-id="${squad.id}" style="${isLocked ? 'opacity: 0.75;' : ''}">
      <div class="card-top">
        <div>
          <span style="font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-dim); text-transform: uppercase;">${hackathonTitle}</span>
          <h3 class="card-title" style="margin-top: 2px;">${squad.title || squad.Title || squad.name || 'Untitled Squad'}</h3>
        </div>
        <span class="status-badge ${isLocked ? '' : 'status-recruiting'}" style="${isLocked ? 'background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: var(--text-muted);' : ''}">
          ${isLocked ? 'Locked' : 'Recruiting'}
        </span>
      </div>

      <p class="card-pitch">${squad.pitch || squad.description || 'No squad mission statement provided.'}</p>

      <div class="tech-tags">
        ${techBadges}
      </div>

      <div class="card-footer" style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-top: 1rem;">
        <span class="role-vacancy" style="font-size: 0.75rem;">
          ${vacantCount > 0 ? `Vacant: <strong>${vacantCount} Open Position${vacantCount > 1 ? 's' : ''}</strong>` : `<strong style="color: var(--text-dim);">Squad Full</strong>`}
        </span>
        
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <!-- ROSTER INSPECTION BUTTON -->
          <button 
            type="button"
            data-squad-id="${squad.id}"
            onclick="event.stopPropagation(); window.openSquadRoster ? window.openSquadRoster('${squad.id}') : console.error('window.openSquadRoster not ready')"
            class="btn inspect-roster-btn" 
            style="padding: 0.45rem 0.75rem; font-size: 0.78rem; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: var(--text-main, #e4e4e7); cursor: pointer; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.35rem;">
            <span style="pointer-events: none;">☩</span> Roster
          </button>

          <!-- SQUAD APPLICATION BUTTON -->
          <button 
            class="btn btn-crimson btn-apply" 
            data-squad-id="${squad.id}" 
            ${isLocked ? 'disabled style="background: rgba(255,255,255,0.05); color: var(--text-dim); cursor: not-allowed; border: 1px solid rgba(255,255,255,0.08);"' : 'style="padding: 0.45rem 0.85rem; font-size: 0.78rem;"'}>
            ${isLocked ? 'Full' : 'Apply'}
          </button>
        </div>
      </div>
    </article>
  `;
}

// ==========================================
  // 2. FETCH SQUADS FROM FASTAPI ON LOAD
  // ==========================================
  async function loadSquadsFromBackend(vacantOnly = false) {
    try {
      squadGrid.innerHTML = `<div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-dim); padding: 2rem;">Connecting to FastAPI feed...</div>`;
      
      const response = await apiClient.getSquads(vacantOnly);

      // Extract the array whether FastAPI returns a list [...] or a paginated dict { "items": [...] }
      const squadList = Array.isArray(response)
        ? response
        : (response.items || response.squads || []);

      currentSquadsCache = squadList;

      if (!squadList || squadList.length === 0) {
        squadGrid.innerHTML = `<div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-dim); padding: 2rem;">No active squads found in database. Deploy one above!</div>`;
        return;
      }

      squadGrid.innerHTML = squadList.map(renderSquadCardHTML).join('');
      attachApplyButtonListeners();

      if (btnFilterAll && !vacantOnly) {
        btnFilterAll.textContent = `All Squads (${squadList.length})`;
      }
    } catch (err) {
      console.error("FastAPI connection failed:", err);
      squadGrid.innerHTML = `
        <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--crimson-red); padding: 2rem; border: 1px dashed rgba(229,9,20,0.3); border-radius: 8px;">
          FastAPI backend not reachable at http://localhost:8000. Start your uvicorn server to load squads.
        </div>
      `;
    }
  }

  // ==========================================
  // 3. ATTACH "APPLY" LISTENERS TO DYNAMIC CARDS
  // ==========================================
  function attachApplyButtonListeners() {
    const applyButtons = squadGrid.querySelectorAll('.btn-apply:not([disabled])');
    applyButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const squadId = e.currentTarget.getAttribute('data-squad-id');
        const squad = currentSquadsCache.find(s => s.id === squadId);

        if (!currentUser) {
          openAuthModal('Role Application');
          return;
        }

        if (squad) {
          openPitchModal(squad);
        }
      });
    });
  }

  // ==========================================
  // 4. MODAL CONTROLS & EVENT LISTENERS
  // ==========================================
  function openAuthModal(context) {
    if (context === 'Build Squad') {
      authTitle.textContent = "Deploy a Squad";
      authDesc.textContent = "Authenticate to configure role slots, review applicant dossiers, and broadcast your recruitment feed.";
    } else if (context === 'Role Application') {
      authTitle.textContent = "Submit Your Pitch";
      authDesc.textContent = "Authenticate to submit your portfolio proof, claim slots, and connect with squad leaders.";
    } else {
      authTitle.textContent = "Join the Arena";
      authDesc.textContent = "Sign in or create an account to access the CollabForge developer workspace.";
    }

    authModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeAuthModal() {
    authModal.classList.remove('open');
    document.body.style.overflow = '';
  }

function openPitchModal(squad) {
    if (!squad) {
      console.error("[CollabForge] openPitchModal called without squad data");
      return;
    }

    selectedSquadForPitch = squad;

    const pitchDesc = document.getElementById('pitch-modal-desc');
    const leaderPanel = document.getElementById('leader-review-panel');

    // Squad meta details
    if (pitchSquadTitle) {
      pitchSquadTitle.textContent = squad.title || squad.Title || 'Squad Pitch';
    }

    if (pitchHackathonBadge) {
      pitchHackathonBadge.textContent = squad.hackathon || squad.hackathon_name || squad.target_hackathon || 'GLOBAL ARENA 2026';
    }

    // Ownership check: UID match or leader handle fallback
    const isLeader = Boolean(
      currentUser && (
        (squad.leader_id && squad.leader_id === currentUser.uid) ||
        (squad.leader && currentUser.handle && squad.leader.toLowerCase() === currentUser.handle.toLowerCase())
      )
    );

    if (isLeader) {
      // --- VIEW B: SQUAD LEADER MODE ---
      if (pitchDesc) {
        pitchDesc.textContent = "Review candidate pitches, dossiers, and fill open role slots.";
      }
      if (pitchForm) pitchForm.style.display = 'none';
      if (leaderPanel) {
        leaderPanel.style.display = 'flex';
        loadLeaderReviewSection(squad);
      }
    } else {
      // --- VIEW A: APPLICANT MODE ---
      if (pitchDesc) {
        pitchDesc.textContent = "Claim a vacant slot by submitting a concise proof-of-work elevator pitch to the squad lead.";
      }
      if (leaderPanel) leaderPanel.style.display = 'none';
      if (pitchForm) pitchForm.style.display = 'block';

      // Populate open role slots
      if (pitchRoleSelect) {
        pitchRoleSelect.innerHTML = '';
        const rawRoles = squad.roles || [];

        const vacantRoles = rawRoles.filter(r => {
          if (typeof r === 'string') return true;
          if (typeof r.is_filled === 'boolean') return !r.is_filled;
          if (r.status) return r.status.toLowerCase() === 'vacant' || r.status.toLowerCase() === 'open';
          return true;
        });

        if (vacantRoles.length === 0) {
          const defaultOption = document.createElement('option');
          defaultOption.value = 'general_contributor';
          defaultOption.textContent = 'General Engineering Contributor';
          pitchRoleSelect.appendChild(defaultOption);
        } else {
          vacantRoles.forEach((role, idx) => {
            const option = document.createElement('option');
            const roleTitle = typeof role === 'string'
              ? role
              : (role.role_title || role.title || role.name || `Role Slot #${idx + 1}`);

            const roleId = (typeof role === 'object' && role !== null)
              ? (role.id || role.slot_id || role.role_title || `slot-${idx + 1}`)
              : `slot-${idx + 1}`;

            option.value = roleId;
            option.textContent = roleTitle;
            pitchRoleSelect.appendChild(option);
          });
        }
      }

      if (pitchForm) pitchForm.reset();
      if (pitchCounter) {
        pitchCounter.textContent = '0 / 300';
        pitchCounter.classList.remove('warning');
      }
    }

    if (pitchModal) {
      pitchModal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closePitchModal() {
    pitchModal.classList.remove('open');
    selectedSquadForPitch = null;
    document.body.style.overflow = '';
  }

  function openCreateSquadModal() {
    createSquadForm.reset();
    rolesContainer.innerHTML = '';
    addRoleRow("Backend Engineer", "Python, FastAPI");
    createSquadModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCreateSquadModal() {
    createSquadModal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function addRoleRow(defaultTitle = '', defaultSkills = '') {
    const row = document.createElement('div');
    row.className = 'role-entry-row';
    row.innerHTML = `
      <input type="text" class="pitch-input role-title" placeholder="Role Title (e.g. ML Engineer)" value="${defaultTitle}" required />
      <input type="text" class="pitch-input role-skills" placeholder="Skills (e.g. OpenCV)" value="${defaultSkills}" required />
      <button type="button" class="btn-remove-role">&times;</button>
    `;

    row.querySelector('.btn-remove-role').addEventListener('click', () => {
      if (rolesContainer.children.length > 1) {
        row.remove();
      } else {
        alert("A squad must specify at least one role slot.");
      }
    });

    rolesContainer.appendChild(row);
  }

  // Pitch character count tracker
  pitchText.addEventListener('input', () => {
    const len = pitchText.value.length;
    pitchCounter.textContent = `${len} / 300`;
    pitchCounter.classList.toggle('warning', len >= 270);
  });

  // ==========================================
    // 5. TRANSMIT PITCH TO FASTAPI (REAL FETCH)
    // ==========================================
    pitchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
  
      if (!currentUser || !currentUser.token) {
        alert("Please sign in before submitting a pitch.");
        openAuthModal('Sign In');
        return;
      }
  
      if (!selectedSquadForPitch) {
        alert("No squad selected.");
        return;
      }
  
      const selectedIdx = pitchRoleSelect.selectedIndex >= 0 ? pitchRoleSelect.selectedIndex : 0;
  
    const payload = {
      squad_id: selectedSquadForPitch.id,
      role_index: selectedIdx, // Satisfies FastAPI's ApplicationCreate schema
      role_id: pitchRoleSelect.value,
      role_name: pitchRoleSelect.options[pitchRoleSelect.selectedIndex]?.text || '',
      applicant_handle: currentUser.handle,
      pitch: pitchText.value.trim(),
      proof_url: pitchProofUrl.value.trim(),
      attach_profile: pitchAttachProfile.checked
    };
  
    try {
      await apiClient.submitPitch(payload, currentUser.token);
      alert(`Pitch transmitted successfully to ${selectedSquadForPitch.title}!`);
      closePitchModal();
    } catch (err) {
      alert("Failed to submit pitch to the server. Check your FastAPI logs.");
    }
  });
  
    // ==========================================
    // 6. BROADCAST SQUAD TO FASTAPI (REAL FETCH)
    // ==========================================
    createSquadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
  
    if (!currentUser || !currentUser.token) {
      alert("Please sign in before creating a squad.");
      openAuthModal('Sign In');
      return;
    }
  
      const roleRows = rolesContainer.querySelectorAll('.role-entry-row');
      const rolesPayload = Array.from(roleRows).map((row, idx) => {
        const roleName = row.querySelector('.role-title')?.value.trim() || '';
        return {
        slot_id: `slot-${idx + 1}`,
        role_title: roleName,
        title: roleName,
        required_skills: row.querySelector('.role-skills')?.value.split(',').map(s => s.trim()).filter(Boolean) || [],
        status: "vacant"
        };
      });
    
      const newSquadPayload = {
        leader: currentUser.handle,
        title: document.getElementById('squad-title-input').value.trim(),
        hackathon: document.getElementById('hackathon-name-input').value.trim(),
        pitch: document.getElementById('squad-pitch-input').value.trim(),
        tech_stack: document.getElementById('squad-tech-input').value.split(',').map(t => t.trim()).filter(Boolean),
        roles: rolesPayload
      };
  
      try {
        // 1. Post to FastAPI backend
        const savedSquad = await apiClient.createSquad(newSquadPayload, currentUser.token);
  
        // 2. Prepend the card into the UI instantly without page reload
        currentSquadsCache.unshift(savedSquad);
        squadGrid.insertAdjacentHTML('afterbegin', renderSquadCardHTML(savedSquad));
        attachApplyButtonListeners();
  
        closeCreateSquadModal();
        alert(`Squad "${savedSquad.title}" deployed and live on feed!`);
      } catch (err) {
        alert("Failed to deploy squad to FastAPI backend.");
      }
    });
  
    // Dynamic role addition button
    if (btnAddRoleRow) btnAddRoleRow.addEventListener('click', () => addRoleRow());
  
    // Tab filter controls
    if (btnFilterVacant && btnFilterAll) {
      btnFilterVacant.addEventListener('click', () => {
        btnFilterVacant.classList.add('active');
        btnFilterAll.classList.remove('active');
        loadSquadsFromBackend(true);
      });
  
      btnFilterAll.addEventListener('click', () => {
        btnFilterAll.classList.add('active');
        btnFilterVacant.classList.remove('active');
        loadSquadsFromBackend(false);
      });
    }
  
    // Session Management
    function setSession(user) {
      currentUser = user;
      if (currentUser) {
        guestControls.style.display = 'none';
        userControls.style.display = 'flex';
        document.getElementById('user-handle').textContent = user.handle;
        document.getElementById('dropdown-name').textContent = user.name;
        closeAuthModal();

        // 1. Sync dropdown counters (Active applications & total squads)
        if (typeof window.updateProfileDropdownCounters === 'function') {
          window.updateProfileDropdownCounters();
        }

        // 2. Trigger empty state / onboarding highlighter callout
        if (typeof window.evaluateOperativeOnboarding === 'function') {
          window.evaluateOperativeOnboarding();
        }
      } else {
        userControls.style.display = 'none';
        guestControls.style.display = 'flex';
        if (profileDropdown) profileDropdown.classList.remove('open');

        // Hide onboarding callout banner on session disconnect
        const calloutCard = document.getElementById('onboarding-highlighter-card');
        if (calloutCard) calloutCard.style.display = 'none';
      }
    }
    let isAuthenticating = false;

    // Initialize Auth Providers
    const googleProvider = new GoogleAuthProvider();
    const githubProvider = new GithubAuthProvider();

    // Real GitHub OAuth Sign-In
    if (btnGithub) {
      btnGithub.addEventListener('click', async () => {
        try {
          const result = await signInWithPopup(auth, githubProvider);
          const user = result.user;
          const token = await user.getIdToken();

          setSession({
            uid: user.uid,
            name: user.displayName || 'GitHub Engineer',
            handle: user.reloadUserInfo?.screenName || user.email?.split('@')[0] || 'dev',
            token: token,
            avatar: user.photoURL || 'https://github.com/identicons/user.png'
          });

          closeAuthModal();
        } catch (error) {
          console.error('[CollabForge Auth Error - GitHub]:', error.code, error.message);
          alert(`GitHub Sign-In failed: ${error.message}`);
        }
      });
    }

    // Real Google OAuth Sign-In
    if (btnGoogle) {
      btnGoogle.addEventListener('click', async () => {
        try {
          const result = await signInWithPopup(auth, googleProvider);
          const user = result.user;
          const token = await user.getIdToken();

          setSession({
            uid: user.uid,
            name: user.displayName || 'Google Engineer',
            handle: user.email?.split('@')[0] || 'dev',
            token: token,
            avatar: user.photoURL || 'https://github.com/identicons/user.png'
          });

          closeAuthModal();
        } catch (error) {
          console.error('[CollabForge Auth Error - Google]:', error.code, error.message);
          alert(`Google Sign-In failed: ${error.message}`);
        }
      });
    }

    // Real Sign-Out
    if (btnSignOut) {
      btnSignOut.addEventListener('click', async () => {
        try {
          await signOut(auth);
          setSession(null);
        } catch (error) {
          console.error('[CollabForge Auth Error - SignOut]:', error);
        }
      });
    }

    // Listen to Auth state on page reload to maintain login
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdToken();
        setSession({
          uid: user.uid,
          name: user.displayName || 'Engineer',
          handle: user.reloadUserInfo?.screenName || user.email?.split('@')[0] || 'dev',
          token: token,
          avatar: user.photoURL || 'https://github.com/identicons/user.png'
        });
      } else {
        setSession(null);
      }
    });
  
    // --- Header and Trigger bindings ---
    if (btnSignIn) {
      btnSignIn.addEventListener('click', () => openAuthModal('Sign In'));
    }
  
    if (btnCreateGuest) {
      btnCreateGuest.addEventListener('click', () => openAuthModal('Build Squad'));
    }
  
    if (btnCreateUser) {
      btnCreateUser.addEventListener('click', openCreateSquadModal);
    }
  
    // Profile dropdown toggles
    if (profileTrigger) {
      profileTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (profileDropdown) profileDropdown.classList.toggle('open');
        profileTrigger.classList.toggle('active');
      });
    }
  
    document.addEventListener('click', (e) => {
      if (profileDropdown && profileTrigger) {
        if (!profileDropdown.contains(e.target) && !profileTrigger.contains(e.target)) {
          profileDropdown.classList.remove('open');
          profileTrigger.classList.remove('active');
        }
      }
    });
  
    // Modal dismiss buttons & outside clicks
    if (authCloseBtn) authCloseBtn.addEventListener('click', closeAuthModal);
    if (pitchCloseBtn) pitchCloseBtn.addEventListener('click', closePitchModal);
    if (createSquadCloseBtn) createSquadCloseBtn.addEventListener('click', closeCreateSquadModal);
  
    [authModal, pitchModal, createSquadModal].forEach(m => {
      if (m) {
        m.addEventListener('click', (e) => {
          if (e.target === m) {
            closeAuthModal();
            closePitchModal();
            closeCreateSquadModal();
          }
        });
      }
    });
  
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAuthModal();
        closePitchModal();
        closeCreateSquadModal();
        if (profileDropdown) profileDropdown.classList.remove('open');
      }
    });
  
// =======================================================
  // LEADER REVIEW LOGIC (Kept INSIDE scope for currentUser)
  // =======================================================
  async function loadLeaderReviewSection(squad) {
    const panel = document.getElementById('leader-review-panel');
    const list = document.getElementById('applications-list');
    const badge = document.getElementById('applications-count-badge');
    const filterSelect = document.getElementById('review-status-filter');

    if (!panel || !list) return;

    // Check ownership: Leader ID vs Active Firebase UID
    const isLeader = currentUser && (squad.leader_id === currentUser.uid);

    if (!isLeader) {
      panel.classList.add('hidden');
      return;
    }

    panel.classList.remove('hidden');
    list.innerHTML = '<p class="text-xs text-zinc-400">Loading incoming pitches...</p>';

    async function fetchAndRender(status) {
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : currentUser.token;
        const applications = await apiClient.getSquadApplications(squad.id, token, status);
        if (badge) badge.textContent = applications.length;

        if (!applications.length) {
          list.innerHTML = `<p class="text-xs text-zinc-500 py-3">No ${status || ''} applications found.</p>`;
          return;
        }

      list.innerHTML = applications.map(app => {
        const isPending = app.status === 'pending';
        const isAccepted = app.status === 'accepted';
        const isRejected = app.status === 'rejected';

      // Check all common field names from FastAPI / Firestore
        const proofLink = app.proof_url || app.proof_link || app.proof || app.link || app.portfolio_url;

      // Ensure link starts with http/https so target="_blank" opens properly
        const formattedProofLink = proofLink && !proofLink.startsWith('http')
          ? `https://${proofLink}`
          : proofLink;

        // Badge theme styles
        const badgeStyle = isAccepted
          ? 'background: rgba(34, 197, 94, 0.12); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3);'
          : isRejected
          ? 'background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);'
          : 'background: rgba(255, 255, 255, 0.08); color: #e4e4e7; border: 1px solid rgba(255, 255, 255, 0.15);';

        return `
          <div id="app-card-${app.id}" style="
            background: rgba(18, 18, 20, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
          ">
            <!-- Header Row: Identity & Status Pill -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
              <div>
                <div style="font-weight: 600; font-size: 0.92rem; color: #fff; display: flex; align-items: center; gap: 0.4rem;">
                  <span>${app.applicant_profile?.display_name || app.applicant_handle || 'Anonymous Dev'}</span>
                  ${app.applicant_handle ? `<span style="font-family: var(--font-mono, monospace); font-size: 0.72rem; color: var(--text-dim, #71717a);">@${app.applicant_handle}</span>` : ''}
                </div>
                <div style="font-family: var(--font-mono, monospace); font-size: 0.75rem; color: #818cf8; margin-top: 2px;">
                  Target Slot: <span style="color: #c7d2fe; font-weight: 500;">${app.role_title || 'General Contributor'}</span>
                </div>
              </div>

              <span style="
                font-family: var(--font-mono, monospace);
                font-size: 0.68rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                padding: 0.2rem 0.55rem;
                border-radius: 4px;
                ${badgeStyle}
              ">
                ${app.status}
              </span>
            </div>

            <!-- Pitch Blockquote Dossier -->
            <div style="
              background: rgba(0, 0, 0, 0.45);
              border-left: 3px solid var(--crimson-red, #e50914);
              padding: 0.7rem 0.85rem;
              border-radius: 0 6px 6px 0;
              font-size: 0.82rem;
              color: #d4d4d8;
              line-height: 1.5;
              font-style: italic;
            ">
              "${app.pitch || 'No elevator pitch provided.'}"
            </div>

            <!-- Verification & Profile Links -->
            <div style="display: flex; align-items: center; gap: 1rem; font-size: 0.75rem;">
              ${app.proof_url ? `
                <a href="${app.proof_url}" target="_blank" rel="noopener noreferrer" style="
                  color: #818cf8;
                  text-decoration: none;
                  display: inline-flex;
                  align-items: center;
                  gap: 0.25rem;
                  font-family: var(--font-mono, monospace);
                ">
                  <span>&#128279; View Proof of Work</span> &rarr;
                </a>
              ` : ''}

              ${app.applicant_profile?.github_url ? `
                <a href="${app.applicant_profile.github_url}" target="_blank" rel="noopener noreferrer" style="
                  color: var(--text-dim, #a1a1aa);
                  text-decoration: none;
                  font-family: var(--font-mono, monospace);
                ">
                  GitHub Profile
                </a>
              ` : ''}
            </div>

            <!-- Action Controls: Accept / Reject (Visible when pending) -->
            ${isPending ? `
              <div style="
                display: flex;
                gap: 0.5rem;
                padding-top: 0.65rem;
                border-top: 1px solid rgba(255, 255, 255, 0.06);
                margin-top: 0.25rem;
              ">
                <button 
                  type="button"
                  onclick="window.handleApplicationAction('${app.id}', 'accept', '${squad.id}')"
                  style="
                    flex: 1;
                    background: #16a34a;
                    color: #ffffff;
                    border: none;
                    padding: 0.45rem 0.75rem;
                    font-size: 0.78rem;
                    font-weight: 600;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background 0.15s ease;
                  "
                  onmouseover="this.style.background='#15803d'"
                  onmouseout="this.style.background='#16a34a'"
                >
                  Accept Candidate
                </button>
                
                <button 
                  type="button"
                  onclick="window.handleApplicationAction('${app.id}', 'reject', '${squad.id}')"
                  style="
                    background: rgba(255, 255, 255, 0.05);
                    color: #f87171;
                    border: 1px solid rgba(239, 68, 68, 0.25);
                    padding: 0.45rem 0.85rem;
                    font-size: 0.78rem;
                    font-weight: 500;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                  "
                  onmouseover="this.style.background='rgba(239, 68, 68, 0.15)'"
                  onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'"
                >
                  Reject
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    } catch (err) {
      list.innerHTML = `<p class="text-xs text-rose-400" style="font-family: var(--font-mono, monospace); color: #f87171; padding: 0.5rem 0;">Failed to load applications: ${err.message}</p>`;
    }
  }

  const initialStatus = filterSelect ? filterSelect.value : 'pending';
  await fetchAndRender(initialStatus);

  if (filterSelect) {
    filterSelect.onchange = (e) => fetchAndRender(e.target.value);
  }
}
 // Global action handler for Accept / Reject
  window.handleApplicationAction = async function(applicationId, action, squadId) {
    if (!confirm(`Are you sure you want to ${action} this candidate?`)) return;

    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : currentUser?.token;
      if (action === 'accept') {
        await apiClient.acceptApplication(applicationId, token);
      } else {
        await apiClient.rejectApplication(applicationId, token);
      }

      alert(`Application successfully ${action}ed!`);
      
      // 1. Refresh Leader Review List inside the modal
      await loadLeaderReviewSection({ id: squadId, leader_id: currentUser.uid });

      // 2. Refresh main feed so the public cards show the slot as filled
      if (typeof loadSquadsFromBackend === 'function') {
        await loadSquadsFromBackend();
      }
    } catch (err) {
      alert(`Failed to ${action} application: ${err.message}`);
    }
  };

  // Expose review caller to openPitchModal inside scope
  window._loadLeaderReviewSection = loadLeaderReviewSection;

  // Initial Data Fetch on Page Load
  loadSquadsFromBackend();
})(); // Closure terminates cleanly at the true end of the script

document.addEventListener('DOMContentLoaded', () => {
  // --- 1. My Applications Modal ---
const btnMyAppsMenu = document.getElementById('menu-my-applications');
const btnCloseMyApps = document.getElementById('close-my-applications-btn');

if (btnMyAppsMenu) {
  btnMyAppsMenu.addEventListener('click', async (e) => {
    e.preventDefault();

    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) dropdown.classList.remove('open', 'active');

    const modal = document.getElementById('my-applications-modal');
    const list = document.getElementById('my-applications-list');

    if (!modal || !list) return;

    // Force modal visible
    modal.classList.remove('hidden');
    modal.classList.add('active', 'open');
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('opacity', '1', 'important');
    modal.style.setProperty('visibility', 'visible', 'important');
    modal.style.setProperty('z-index', '99999', 'important');

    list.innerHTML = '<div style="text-align:center; color:#71717a; font-size:0.85rem; padding: 2rem 0;">Loading your applications...</div>';

    try {
      const token = await window.auth.currentUser.getIdToken();
      const apps = await apiClient.getMyApplications(token);

      // Sync the dropdown counter dynamically
      const counterEl = document.getElementById('counter-my-applications');
      if (counterEl) {
        const pendingCount = (apps || []).filter(a => (a.status || '').toLowerCase() === 'pending').length;
        counterEl.textContent = `${pendingCount} Active`;
      }

      if (!apps || apps.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#71717a; font-size:0.85rem; padding: 2rem 0;">You have not applied to any squads yet.</div>';
        return;
      }

      list.innerHTML = apps.map(app => {
        const appId = app.id || app._id || app.application_id;
        const status = (app.status || 'pending').toLowerCase();

        const badgeColor = status === 'accepted' ? '#4ade80' : status === 'rejected' ? '#f87171' : status === 'withdrawn' ? '#71717a' : '#60a5fa';
        const badgeBg = status === 'accepted' ? 'rgba(34, 197, 94, 0.12)' : status === 'rejected' ? 'rgba(239, 68, 68, 0.12)' : status === 'withdrawn' ? 'rgba(113, 113, 122, 0.15)' : 'rgba(59, 130, 246, 0.12)';

        // Show withdraw button strictly for pending applications
        const canWithdraw = status === 'pending';

        return `
          <div id="application-card-${appId}" style="
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 8px;
            padding: 1.1rem;
            display: flex;
            flex-direction: column;
            gap: 0.6rem;
            transition: all 0.2s ease;
          ">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
              <div>
                <div style="font-weight: 600; color: #fff; font-size: 0.95rem; letter-spacing: -0.01em;">${app.squad_title || 'Squad Application'}</div>
                <div style="font-family: monospace; font-size: 0.75rem; color: #818cf8; margin-top: 2px;">Role: ${app.role_title || `Role #${(app.role_index ?? 0) + 1}`}</div>
              </div>
              
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="
                  font-family: monospace;
                  font-size: 0.7rem;
                  text-transform: uppercase;
                  padding: 0.2rem 0.55rem;
                  border-radius: 4px;
                  background: ${badgeBg};
                  color: ${badgeColor};
                  border: 1px solid ${badgeColor}33;
                ">${app.status}</span>

                ${canWithdraw ? `
                  <button 
                    type="button"
                    class="btn-withdraw-app"
                    data-app-id="${appId}"
                    style="
                      background: rgba(239, 68, 68, 0.1);
                      border: 1px solid rgba(239, 68, 68, 0.3);
                      color: #f87171;
                      font-size: 0.7rem;
                      font-family: monospace;
                      padding: 0.25rem 0.6rem;
                      border-radius: 4px;
                      cursor: pointer;
                      display: inline-flex;
                      align-items: center;
                      gap: 0.25rem;
                      transition: all 0.2s ease;
                    "
                    onmouseover="this.style.background='rgba(239, 68, 68, 0.25)'; this.style.borderColor='rgba(239, 68, 68, 0.6)';"
                    onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'; this.style.borderColor='rgba(239, 68, 68, 0.3)';"
                  >
                    <span>✕ Withdraw</span>
                  </button>
                ` : ''}
              </div>
            </div>

            <div style="font-size: 0.8rem; color: #a1a1aa; font-style: italic; line-height: 1.4;">
              "${app.pitch || 'No pitch provided.'}"
            </div>

            ${app.proof_url ? `
              <div style="margin-top: 0.25rem;">
                <a href="${app.proof_url}" target="_blank" rel="noopener noreferrer" style="color: #818cf8; font-size: 0.75rem; text-decoration: underline;">
                  View Submitted Proof &rarr;
                </a>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('[CollabForge] Error loading applications:', err);
      list.innerHTML = `<div style="text-align:center; color:#f87171; font-size:0.85rem; padding: 2rem 0;">Failed to load: ${err.message}</div>`;
    }
  });
}

// Delegated Click Listener for Withdraw Button
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-withdraw-app');
  if (!btn) return;

  e.preventDefault();
  const appId = btn.getAttribute('data-app-id');
  if (!appId) return;

  const confirmWithdraw = confirm('Are you sure you want to withdraw this application?');
  if (!confirmWithdraw) return;

  btn.disabled = true;
  btn.textContent = 'Withdrawing...';

  try {
    const token = await window.auth.currentUser.getIdToken();
    
    // Matched directly to POST /api/applications/{application_id}/withdraw
    const res = await fetch(`http://127.0.0.1:8000/api/applications/${appId}/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP ${res.status}`);
    }

    // Update DOM: Replace card content with a clean deactivated status badge
    const card = document.getElementById(`application-card-${appId}`);
    if (card) {
      card.style.opacity = '0.55';
      card.style.borderColor = 'rgba(255, 255, 255, 0.04)';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0;">
          <span style="font-size: 0.8rem; color: #71717a; font-family: monospace;">APPLICATION STATUS UPDATED</span>
          <span style="font-family: monospace; font-size: 0.7rem; text-transform: uppercase; padding: 0.2rem 0.5rem; border-radius: 4px; background: rgba(113, 113, 122, 0.15); color: #71717a; border: 1px solid rgba(113, 113, 122, 0.25);">WITHDRAWN</span>
        </div>
      `;
    }

    // Decrement dropdown counter dynamically
    const counterEl = document.getElementById('counter-my-applications');
    if (counterEl) {
      const currentVal = parseInt(counterEl.textContent, 10);
      if (!isNaN(currentVal) && currentVal > 0) {
        counterEl.textContent = `${currentVal - 1} Active`;
      }
    }

    alert('Application withdrawn successfully.');
  } catch (err) {
    console.error('[CollabForge] Withdraw failed:', err);
    alert(`Failed to withdraw application: ${err.message}`);
    btn.disabled = false;
    btn.textContent = '✕ Withdraw';
  }
});

if (btnCloseMyApps) {
  btnCloseMyApps.addEventListener('click', () => {
    const modal = document.getElementById('my-applications-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('active', 'open');
      modal.style.setProperty('display', 'none', 'important');
      modal.style.setProperty('opacity', '0', 'important');
      modal.style.setProperty('visibility', 'hidden', 'important');
    }
  });
}
// --- 2. My Squads Modal ---
const btnMySquadsMenu = document.getElementById('menu-my-squads');
const btnCloseMySquads = document.getElementById('close-my-squads-btn');

if (btnMySquadsMenu) {
  btnMySquadsMenu.addEventListener('click', async (e) => {
    e.preventDefault();

    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) dropdown.classList.remove('open', 'active');

    const modal = document.getElementById('my-squads-modal');
    const list = document.getElementById('my-squads-list');

    if (!modal || !list) return;

    modal.classList.remove('hidden');
    modal.classList.add('active', 'open');
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('opacity', '1', 'important');
    modal.style.setProperty('visibility', 'visible', 'important');
    modal.style.setProperty('z-index', '99999', 'important');

    list.innerHTML = '<div style="text-align:center; color:#71717a; font-size:0.85rem; padding: 2rem 0;">Loading your squads...</div>';

    try {
      const token = await window.auth.currentUser.getIdToken();
      const resData = await apiClient.getMySquads(token);

      const leadingSquads = Array.isArray(resData?.leading) ? resData.leading : [];
      const joinedSquads = Array.isArray(resData?.joined) ? resData.joined : [];
      const squads = [...leadingSquads, ...joinedSquads];

      // --- Live Counter Sync ---
      const squadCounterEl = document.getElementById('counter-my-squads');
      if (squadCounterEl) {
        squadCounterEl.textContent = `${squads.length} Total`;
      }

      if (squads.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#71717a; font-size:0.85rem; padding: 2rem 0;">You have not deployed or joined any squads yet.</div>';
        return;
      }

      list.innerHTML = squads.map(squad => {
        const roles = squad.roles || [];
        const filledRoles = roles.filter(r => r.is_filled || r.filled || r.status === 'filled').length;
        const currentUserId = window.auth?.currentUser?.uid;
        const isLeader = leadingSquads.some(s => s.id === squad.id) || squad.leader_id === currentUserId;
        const squadDescription = squad.pitch || squad.description || 'No description provided.';
        const resolvedSquadId = squad.id || squad._id || squad.squad_id || '';

        return `
          <div style="
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 8px;
            padding: 1.2rem;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          ">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; flex-wrap: wrap;">
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-weight: 700; color: #fff; font-size: 1rem;">${squad.title || squad.name}</span>
                  <span style="
                    font-size: 0.65rem;
                    font-family: monospace;
                    text-transform: uppercase;
                    padding: 0.15rem 0.4rem;
                    border-radius: 4px;
                    background: ${isLeader ? 'rgba(99, 102, 241, 0.15)' : 'rgba(34, 197, 94, 0.15)'};
                    color: ${isLeader ? '#818cf8' : '#4ade80'};
                    border: 1px solid ${isLeader ? 'rgba(99, 102, 241, 0.3)' : 'rgba(34, 197, 94, 0.3)'};
                  ">${isLeader ? 'Squad Leader' : 'Member'}</span>
                </div>
                <div style="font-size: 0.75rem; color: #818cf8; font-family: monospace; margin-top: 4px;">
                  ROSTER: ${filledRoles} / ${roles.length} SLOTS FILLED
                </div>
              </div>

              <!-- Action Buttons -->
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <button 
                  type="button" 
                  class="btn-view-squad-roster"
                  data-squad-id="${resolvedSquadId}"
                  style="
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    color: #e4e4e7;
                    font-size: 0.75rem;
                    font-family: monospace;
                    font-weight: 600;
                    padding: 0.4rem 0.75rem;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                  "
                  onmouseover="this.style.background='rgba(255, 255, 255, 0.12)';"
                  onmouseout="this.style.background='rgba(255, 255, 255, 0.06)';"
                >
                  View Squad ⤢
                </button>

                ${isLeader ? `
                  <button 
                    type="button"
                    class="btn-edit-squad"
                    data-squad-id="${resolvedSquadId}"
                    style="
                      font-size: 0.75rem;
                      font-family: monospace;
                      font-weight: 600;
                      padding: 0.4rem 0.75rem;
                      border-radius: 6px;
                      background: rgba(59, 130, 246, 0.12);
                      border: 1px solid rgba(59, 130, 246, 0.35);
                      color: #60a5fa;
                      cursor: pointer;
                      transition: all 0.2s ease;
                    "
                    onmouseover="this.style.background='rgba(59, 130, 246, 0.25)'; this.style.borderColor='rgba(59, 130, 246, 0.6)';"
                    onmouseout="this.style.background='rgba(59, 130, 246, 0.12)'; this.style.borderColor='rgba(59, 130, 246, 0.35)';"
                  >
                    Edit Squad ⚙
                  </button>

                  <button 
                    type="button"
                    class="btn-review-applications" 
                    data-squad-id="${resolvedSquadId}"
                    style="
                      background: #4f46e5;
                      border: none;
                      color: #fff;
                      font-size: 0.75rem;
                      font-weight: 600;
                      padding: 0.4rem 0.8rem;
                      border-radius: 6px;
                      cursor: pointer;
                      transition: background 0.2s;
                    "
                    onmouseover="this.style.background='#4338ca';"
                    onmouseout="this.style.background='#4f46e5';"
                  >
                    Review Pitches
                  </button>
                ` : ''}
              </div>
            </div>

            <p style="font-size: 0.8rem; color: #a1a1aa; margin: 0; line-height: 1.4;">
              ${squadDescription}
            </p>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              ${roles.map(r => {
                const roleTitle = r.title || r.role_title || r.name || r.role || 'Specialist';
                const isFilled = r.is_filled || r.filled || r.status === 'filled';

                return `
                  <span style="
                    font-family: monospace;
                    font-size: 0.7rem;
                    padding: 0.2rem 0.5rem;
                    border-radius: 4px;
                    background: ${isFilled ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.05)'};
                    color: ${isFilled ? '#4ade80' : '#71717a'};
                    border: 1px solid ${isFilled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
                  ">
                    ${roleTitle} (${isFilled ? 'FILLED' : 'OPEN'})
                  </span>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('');

      // 1. Review Pitches Click Handlers
      list.querySelectorAll('.btn-review-applications').forEach(button => {
        button.addEventListener('click', (e) => {
          const squadId = e.currentTarget.getAttribute('data-squad-id');
          const targetSquad = squads.find(s => (s.id || s._id || s.squad_id) === squadId);

          modal.classList.add('hidden');
          modal.classList.remove('active', 'open');
          modal.style.setProperty('display', 'none', 'important');
          modal.style.setProperty('opacity', '0', 'important');
          modal.style.setProperty('visibility', 'hidden', 'important');

          if (typeof openReviewModal === 'function') {
            openReviewModal(targetSquad);
          }
        });
      });

      // 2. View Squad Roster Click Handlers
      list.querySelectorAll('.btn-view-squad-roster').forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          const squadId = e.currentTarget.getAttribute('data-squad-id');

          if (!squadId || squadId === 'null' || squadId === 'undefined') {
            console.error('[CollabForge] Invalid squad ID on button element:', e.currentTarget);
            return;
          }

          modal.classList.add('hidden');
          modal.classList.remove('active', 'open');
          modal.style.setProperty('display', 'none', 'important');
          modal.style.setProperty('opacity', '0', 'important');
          modal.style.setProperty('visibility', 'hidden', 'important');

          if (typeof window.openSquadRoster === 'function') {
            window.openSquadRoster(squadId);
          } else {
            console.error('[CollabForge] window.openSquadRoster is not defined on window scope.');
          }
        });
      });

    } catch (err) {
      console.error('[CollabForge] Error loading squads:', err);
      list.innerHTML = `<div style="text-align:center; color:#f87171; font-size:0.85rem; padding: 2rem 0;">Failed to load squads: ${err.message}</div>`;
    }
  });
}

if (btnCloseMySquads) {
  btnCloseMySquads.addEventListener('click', () => {
    const modal = document.getElementById('my-squads-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('active', 'open');
      modal.style.setProperty('display', 'none', 'important');
      modal.style.setProperty('opacity', '0', 'important');
      modal.style.setProperty('visibility', 'hidden', 'important');
    }
  });
}

// Global Delegated Handler for Edit Squad Button
document.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".btn-edit-squad");
  if (editBtn) {
    e.preventDefault();
    const squadId = editBtn.getAttribute("data-squad-id");
    if (window.openEditSquadModal) {
      window.openEditSquadModal(squadId);
    }
  }
});

/// --- 3. Edit Portfolio Dossier Modal ---
  const btnDossierMenu = document.getElementById('menu-edit-portfolio');
  const modalDossier = document.getElementById('portfolio-dossier-modal');
  const btnCloseDossier = document.getElementById('close-portfolio-modal-btn');
  const formDossier = document.getElementById('portfolio-dossier-form');
  const dossierStatusMsg = document.getElementById('dossier-status-msg');

  // Input bindings
  const inputDisplayName = document.getElementById('dossier-display-name');
  const inputContactHandle = document.getElementById('dossier-contact-handle');
  const inputBio = document.getElementById('dossier-bio');
  const inputSkills = document.getElementById('dossier-skills');
  const inputGithub = document.getElementById('dossier-github');
  const inputPortfolio = document.getElementById('dossier-portfolio');

  // 3a. Open & Pre-fill Dossier Modal
  if (btnDossierMenu && modalDossier) {
    btnDossierMenu.addEventListener('click', async (e) => {
      e.preventDefault();

      // 1. Close profile dropdown
      const dropdown = document.getElementById('profile-dropdown');
      if (dropdown) dropdown.classList.remove('open', 'active');

      // 2. Open Modal
      modalDossier.classList.remove('hidden');
      modalDossier.classList.add('active', 'open');
      modalDossier.style.setProperty('display', 'flex', 'important');
      modalDossier.style.setProperty('opacity', '1', 'important');
      modalDossier.style.setProperty('visibility', 'visible', 'important');
      modalDossier.style.setProperty('z-index', '99999', 'important');

      if (dossierStatusMsg) dossierStatusMsg.textContent = 'Syncing remote state...';

      // 3. Pre-fill data
      try {
        const authInstance = window.auth;
        if (!authInstance || !authInstance.currentUser) {
          throw new Error('No active session found.');
        }

        const token = await authInstance.currentUser.getIdToken();
        const profile = await apiClient.getProfile(token);

        if (inputDisplayName) {
          inputDisplayName.value = profile.display_name || profile.name || authInstance.currentUser.displayName || '';
        }
        if (inputContactHandle) {
          inputContactHandle.value = profile.contact_handle || '';
        }
        if (inputBio) {
          inputBio.value = profile.bio || '';
        }
        if (inputSkills) {
          const skills = profile.primary_skills || profile.skills || [];
          inputSkills.value = Array.isArray(skills) ? skills.join(', ') : skills;
        }
        if (inputGithub) {
          inputGithub.value = profile.github_url || '';
        }
        if (inputPortfolio) {
          inputPortfolio.value = profile.portfolio_url || '';
        }

        if (dossierStatusMsg) dossierStatusMsg.textContent = '';
      } catch (err) {
        console.warn('[CollabForge] Could not pre-fill profile data:', err);
        if (window.auth?.currentUser && inputDisplayName) {
          inputDisplayName.value = window.auth.currentUser.displayName || '';
        }
        if (dossierStatusMsg) dossierStatusMsg.textContent = 'Editing local copy';
      }
    });
  }

  // 3b. Handle Dossier Form Submission
  if (formDossier) {
    formDossier.addEventListener('submit', async (e) => {
      e.preventDefault();

      const btnSubmit = document.getElementById('save-dossier-btn');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Committing...';
      }
      if (dossierStatusMsg) dossierStatusMsg.textContent = '';

      try {
        const authInstance = window.auth;
        if (!authInstance || !authInstance.currentUser) {
          throw new Error('Session expired. Please re-authenticate.');
        }

        const token = await authInstance.currentUser.getIdToken();

        const rawSkills = inputSkills ? inputSkills.value : '';
        const primarySkills = rawSkills
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

        const payload = {
          display_name: inputDisplayName ? inputDisplayName.value.trim() : '',
          bio: inputBio ? inputBio.value.trim() : '',
          github_url: inputGithub ? inputGithub.value.trim() : '',
          portfolio_url: inputPortfolio ? inputPortfolio.value.trim() : '',
          primary_skills: primarySkills,
          contact_handle: inputContactHandle ? inputContactHandle.value.trim() : ''
        };

        await apiClient.updateProfile(token, payload);

        if (dossierStatusMsg) {
          dossierStatusMsg.style.color = '#4ade80';
          dossierStatusMsg.textContent = 'Dossier committed successfully!';
        }

        setTimeout(() => {
          modalDossier.style.setProperty('display', 'none', 'important');
          modalDossier.style.setProperty('opacity', '0', 'important');
          modalDossier.style.setProperty('visibility', 'hidden', 'important');
          if (dossierStatusMsg) {
            dossierStatusMsg.textContent = '';
            dossierStatusMsg.style.color = '#71717a';
          }
        }, 800);
      } catch (err) {
        console.error('[CollabForge] Failed to update dossier:', err);
        if (dossierStatusMsg) {
          dossierStatusMsg.style.color = '#f87171';
          dossierStatusMsg.textContent = `Commit failed: ${err.message}`;
        }
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'Commit Changes';
        }
      }
    });
  }

  // 3c. Close Dossier Modal
  if (btnCloseDossier && modalDossier) {
    btnCloseDossier.addEventListener('click', () => {
      modalDossier.classList.add('hidden');
      modalDossier.classList.remove('active', 'open');
      modalDossier.style.setProperty('display', 'none', 'important');
      modalDossier.style.setProperty('opacity', '0', 'important');
      modalDossier.style.setProperty('visibility', 'hidden', 'important');
    });
  }

  // --- 4. Review Pitches Squad Leader Command (My Squads) ---
  window.openReviewModal = async function (targetSquad) {
    const modal = document.getElementById('review-pitches-modal');
    const list = document.getElementById('review-pitches-list');
    const titleEl = document.getElementById('review-squad-title');

    if (!modal || !list) {
      console.error('[CollabForge] Missing #review-pitches-modal markup.');
      return;
    }

    if (titleEl && targetSquad) {
      titleEl.textContent = `${targetSquad.title} //`;
    }

    modal.classList.remove('hidden');
    modal.classList.add('active', 'open');
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('opacity', '1', 'important');
    modal.style.setProperty('visibility', 'visible', 'important');
    modal.style.setProperty('z-index', '100000', 'important');

    list.innerHTML = '<div style="text-align:center; color:#71717a; font-size:0.85rem; padding: 2rem 0;">Loading candidate pitches...</div>';

    try {
      const authInstance = window.auth;
      if (!authInstance || !authInstance.currentUser) {
        throw new Error('No active session found.');
      }

      const token = await authInstance.currentUser.getIdToken();
      const res = await fetch(`http://localhost:8000/api/applications/squad/${targetSquad.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch applications`);
      const applicants = await res.json();

      if (!applicants || applicants.length === 0) {
        list.innerHTML = `
          <div style="text-align:center; color:#71717a; font-size:0.85rem; padding: 2.5rem 0;">
            <p style="margin: 0 0 0.4rem 0; color: #e4e4e7; font-weight: 600;">No Pending Pitches</p>
            No candidates have submitted applications for this squad yet.
          </div>
        `;
        return;
      }

      list.innerHTML = applicants.map(app => {
        const isPending = app.status === 'pending';
        const badgeColor = app.status === 'accepted' ? '#4ade80' : app.status === 'rejected' ? '#f87171' : '#e4e4e7';
        const badgeBg = app.status === 'accepted' ? 'rgba(34, 197, 94, 0.12)' : app.status === 'rejected' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.08)';

        return `
          <div style="
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            padding: 1.1rem;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          ">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="color: #fff; font-weight: 700; font-size: 0.95rem;">
                  ${app.applicant_name || app.display_name || app.user_id || 'Applicant'}
                </div>
                <div style="font-family: monospace; font-size: 0.75rem; color: #818cf8; margin-top: 2px;">
                  Role: ${app.role_title || `Role #${(app.role_index ?? 0) + 1}`}
                </div>
              </div>
              <span style="
                font-family: monospace;
                font-size: 0.7rem;
                text-transform: uppercase;
                padding: 0.2rem 0.5rem;
                border-radius: 4px;
                background: ${badgeBg};
                color: ${badgeColor};
              ">${app.status}</span>
            </div>

            <div style="font-size: 0.82rem; color: #d4d4d8; background: rgba(0, 0, 0, 0.25); padding: 0.75rem; border-radius: 6px; line-height: 1.4;">
              "${app.pitch || 'No pitch statement provided.'}"
            </div>

            ${app.proof_url ? `
              <div>
                <a href="${app.proof_url}" target="_blank" rel="noopener noreferrer" style="color: #818cf8; font-size: 0.75rem; text-decoration: underline;">
                  View Candidate Work Sample &rarr;
                </a>
              </div>
            ` : ''}

            ${isPending ? `
              <div style="display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 0.25rem;">
                <button class="btn-reject-app" data-app-id="${app.id}" style="
                  background: rgba(239, 68, 68, 0.15);
                  border: 1px solid rgba(239, 68, 68, 0.3);
                  color: #f87171;
                  font-size: 0.75rem;
                  font-weight: 600;
                  padding: 0.35rem 0.8rem;
                  border-radius: 6px;
                  cursor: pointer;
                ">Reject</button>
                <button class="btn-accept-app" data-app-id="${app.id}" style="
                  background: #16a34a;
                  border: none;
                  color: #fff;
                  font-size: 0.75rem;
                  font-weight: 600;
                  padding: 0.35rem 0.85rem;
                  border-radius: 6px;
                  cursor: pointer;
                ">Accept Candidate</button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      // Wire Accept buttons
      list.querySelectorAll('.btn-accept-app').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const appId = e.currentTarget.getAttribute('data-app-id');
          btn.disabled = true;
          btn.textContent = 'Accepting...';
          try {
            await fetch(`http://localhost:8000/api/applications/${appId}/accept`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` }
            });
            window.openReviewModal(targetSquad);
          } catch (err) {
            console.error('Failed to accept candidate:', err);
            btn.textContent = 'Error';
          }
        });
      });

      // Wire Reject buttons
      list.querySelectorAll('.btn-reject-app').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const appId = e.currentTarget.getAttribute('data-app-id');
          btn.disabled = true;
          btn.textContent = 'Rejecting...';
          try {
            await fetch(`http://localhost:8000/api/applications/${appId}/reject`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` }
            });
            window.openReviewModal(targetSquad);
          } catch (err) {
            console.error('Failed to reject candidate:', err);
            btn.textContent = 'Error';
          }
        });
      });

    } catch (err) {
      console.error('[CollabForge] Error loading squad applicants:', err);
      list.innerHTML = `<div style="text-align:center; color:#f87171; font-size:0.85rem; padding: 2rem 0;">Failed to load applicants: ${err.message}</div>`;
    }
  };

  // Wire Review Pitches Close button
  const closeReviewBtn = document.getElementById('close-review-pitches-btn');
  if (closeReviewBtn) {
    closeReviewBtn.addEventListener('click', () => {
      const modal = document.getElementById('review-pitches-modal');
      if (modal) {
        modal.style.setProperty('display', 'none', 'important');
        modal.style.setProperty('opacity', '0', 'important');
        modal.style.setProperty('visibility', 'hidden', 'important');
      }
    });
  }

  // --- 5. Achievements Auth Lifecycle & Add Badge ---
  const authClient = window.auth || (typeof auth !== 'undefined' ? auth : null);

  if (authClient && typeof authClient.onAuthStateChanged === 'function') {
    authClient.onAuthStateChanged(async (user) => {
      if (!user) return;

      try {
        const token = await user.getIdToken();
        await loadAchievementsUI(user.uid, token);
      } catch (err) {
        console.error('Failed to load initial achievements:', err);
      }

      const btnAddAch = document.getElementById('btn-add-achievement');
      if (btnAddAch && !btnAddAch.dataset.listenerAttached) {
        btnAddAch.dataset.listenerAttached = 'true';

        btnAddAch.addEventListener('click', async (e) => {
          e.preventDefault();
          const titleInput = document.getElementById('achievement-title');
          const descInput = document.getElementById('achievement-desc');
          const imgInput = document.getElementById('achievement-image-url');
          const projInput = document.getElementById('achievement-project-url');

          if (!titleInput || !titleInput.value.trim()) {
            alert('Please enter an achievement title.');
            return;
          }

          btnAddAch.disabled = true;
          btnAddAch.textContent = 'Adding...';

          try {
            const freshToken = await user.getIdToken();
            const payload = {
              title: titleInput.value.trim(),
              description: descInput ? descInput.value.trim() : '',
              image_url: imgInput ? imgInput.value.trim() : '',
              project_url: projInput ? projInput.value.trim() : ''
            };

            await apiClient.addAchievement(freshToken, payload);

            titleInput.value = '';
            if (descInput) descInput.value = '';
            if (imgInput) imgInput.value = '';
            if (projInput) projInput.value = '';

            await loadAchievementsUI(user.uid, freshToken);
          } catch (err) {
            console.error('Failed to add achievement:', err);
            alert(`Could not save achievement: ${err.message}`);
          } finally {
            btnAddAch.disabled = false;
            btnAddAch.textContent = '+ Add Badge';
          }
        });
      }
    });
  }

// --- 6. Function to Fetch and Render User Achievements ---
async function loadAchievementsUI(userId, token) {
  const container = document.getElementById('dossier-achievements-list');
  if (!container) return;

  try {
    const list = await apiClient.getAchievements(userId, token);
    if (!list || list.length === 0) {
      container.innerHTML = '<div style="font-size: 0.75rem; color: #71717a; font-family: monospace;">No achievements registered yet.</div>';
      return;
    }

    container.innerHTML = list.map(item => `
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 6px;
        padding: 0.55rem 0.8rem;
      ">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          ${item.image_url ? `<img src="${item.image_url}" alt="Badge" style="width: 28px; height: 28px; border-radius: 4px; object-fit: cover;" onerror="this.style.display='none'" />` : ''}
          <div>
            <div style="font-size: 0.82rem; font-weight: 700; color: #fff;">
              ${item.title}
              ${item.project_url ? `<a href="${item.project_url}" target="_blank" rel="noopener noreferrer" style="font-size: 0.7rem; color: #818cf8; margin-left: 0.4rem; text-decoration: none;">&nearr;</a>` : ''}
            </div>
            <div style="font-size: 0.72rem; color: #a1a1aa;">${item.description || ''}</div>
          </div>
        </div>
        <button type="button" class="btn-delete-achievement" data-ach-id="${item.id}" style="
          background: transparent;
          border: none;
          color: #71717a;
          font-size: 1.1rem;
          cursor: pointer;
          line-height: 1;
          padding: 0 0.2rem;
        " title="Delete Badge">&times;</button>
      </div>
    `).join('');

    // Attach delete listeners
    container.querySelectorAll('.btn-delete-achievement').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const achId = btn.getAttribute('data-ach-id');
        btn.disabled = true;
        try {
          await apiClient.deleteAchievement(token, achId);
          await loadAchievementsUI(userId, token);
        } catch (err) {
          console.error('Failed to delete achievement:', err);
          btn.disabled = false;
        }
      });
    });

  } catch (err) {
    console.error('Failed to load achievements:', err);
    container.innerHTML = '<div style="font-size: 0.72rem; color: #f87171; font-family: monospace;">Failed to load achievements.</div>';
  }
}})