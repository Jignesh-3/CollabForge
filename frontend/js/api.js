/**
 * CollabForge — Client API Service Layer
 */

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : 'https://collabforge-o7db.onrender.com';

export const apiClient = {
  // 1. Fetch Active Squads
  async getSquads(vacantOnly = false) {
    try {
      const url = vacantOnly 
        ? `${API_BASE_URL}/squads?vacant_only=true` 
        : `${API_BASE_URL}/squads`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch squads`);
      return await res.json();
    } catch (err) {
      console.error('[API Error - getSquads]:', err);
      throw err;
    }
  },

  // 2. Broadcast / Deploy New Squad
  async createSquad(squadPayload, authToken) {
    try {
      const res = await fetch(`${API_BASE_URL}/squads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(squadPayload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Squad deployment rejected`);
      return await res.json();
    } catch (err) {
      console.error('[API Error - createSquad]:', err);
      throw err;
    }
  },

  // 3. Transmit Pitch Application
  async submitPitch(pitchPayload, authToken) {
    try {
      const res = await fetch(`${API_BASE_URL}/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(pitchPayload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Pitch submission failed`);
      return await res.json();
    } catch (err) {
      console.error('[API Error - submitPitch]:', err);
      throw err;
    }
  },

  // 4. Retrieve Squad Applications (Squad Leader Only)
  async getSquadApplications(squadId, authToken, statusFilter = 'pending') {
    try {
      const url = statusFilter
        ? `${API_BASE_URL}/applications/squad/${squadId}?status_filter=${statusFilter}`
        : `${API_BASE_URL}/applications/squad/${squadId}`;
        
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch applications`);
      return await res.json();
    } catch (err) {
      console.error('[API Error - getSquadApplications]:', err);
      throw err;
    }
  },

  // 5. Accept Pitch Application
  async acceptApplication(applicationId, authToken) {
    try {
      const res = await fetch(`${API_BASE_URL}/applications/${applicationId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to accept application`);
      return await res.json();
    } catch (err) {
      console.error('[API Error - acceptApplication]:', err);
      throw err;
    }
  },

  // 6. Reject Pitch Application
  async rejectApplication(applicationId, authToken) {
    try {
      const res = await fetch(`${API_BASE_URL}/applications/${applicationId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to reject application`);
      return await res.json();
    } catch (err) {
      console.error('[API Error - rejectApplication]:', err);
      throw err;
    }
  },

  // 7. Fetch candidate's own submitted applications
  async getMyApplications(authToken) {
    try {
      const res = await fetch(`${API_BASE_URL}/applications/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch your applications`);
      return await res.json();
    } catch (err) {
      console.error('[API Error - getMyApplications]:', err);
      throw err;
    }
  }, // <-- Just a comma here to separate the methods

  // 8. Retrieve Squads Created by Current User
  async getMySquads(authToken) {
    try {
      const res = await fetch(`${API_BASE_URL}/squads/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch your squads`);
      return await res.json();
    } catch (err) {
      console.error('[API Error - getMySquads]:', err);
      throw err;
    }
  },

// 9. Fetch Profile / Dossier
  async getProfile(authToken) {
    try {
      const res = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch profile`);
      return await res.json();
    } catch (err) {
      console.error('[API Error - getProfile]:', err);
      throw err;
    }
  },

  // 10. Update Profile / Dossier
  async updateProfile(authToken, payload) {
    try {
      const res = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to update profile`);
      return await res.json();
    } catch (err) {
      console.error('[API Error - updateProfile]:', err);
      throw err;
    }
  },

  // Get current user's achievements
  async getAchievements(userId, authToken) {
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}/achievements`, {
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch achievements`);
      return await res.json();
    } catch (err) {
      console.error('[API Error - getAchievements]:', err);
      throw err;
    }
  },

  // Add new achievement
  async addAchievement(authToken, payload) {
    try {
      const res = await fetch(`${API_BASE_URL}/users/me/achievements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to add achievement`);
      return await res.json();
    } catch (err) {
      console.error('[API Error - addAchievement]:', err);
      throw err;
    }
  },

  // Delete achievement
  async deleteAchievement(authToken, achievementId) {
    try {
      const res = await fetch(`${API_BASE_URL}/users/me/achievements/${achievementId}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to delete achievement`);
      return await res.json();
    } catch (err) {
      console.error('[API Error - deleteAchievement]:', err);
      throw err;
    }
  },

  // Public Operative Dossier Profile Fetch
  async getUserProfile(userId) {
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load operative profile`);
      return await res.json();
    } catch (err) {
      console.error('[API Error - getUserProfile]:', err);
      throw err;
    }
  }
};