// public/js/components/profile.js
// ============================================================
// Alpine component for the My Profile screen.
// Replaces APP.loadProfile (+ APP.saveDeputy, removeDeputy, requestLeave).
//
// Template: /templates/profile.html
// ============================================================

window.Components = window.Components || {};

window.Components.profile = function() {
  return {
    // ── State ──────────────────────────────────────────────
    loading:       true,
    user:          null,
    deputyOptions: [],
    deputySelected: '',
    leaveFrom:     '',
    leaveTo:       '',
    leaveReason:   '',
    savingDeputy:  false,
    requestingLeave: false,

    // ── Computed ──────────────────────────────────────────
    get streamLabel() { return this.user?.stream || 'All'; },
    get roleLabel()   { return (this.user?.role || '').replace(/_/g, ' '); },
    get showDeputyCard() {
      const role = this.user?.role;
      return ['design_head','services_head','pmc_head'].includes(role);
    },
    get showLeaveCard() {
      return this.user?.role === 'site_manager';
    },

    // ── Lifecycle ─────────────────────────────────────────
    async init() {
      const res = await API.call('GET', '/users/me');
      this.user = res?.user || APP?.user || null;
      this.deputySelected = this.user?.deputy_id || '';

      if (this.showDeputyCard) {
        const usersRes = await API.call('GET', '/users/deputy-candidates');
        this.deputyOptions = usersRes?.users || [];
      }
      this.loading = false;
    },

    // ── Actions ───────────────────────────────────────────
    async saveDeputy() {
      if (this.savingDeputy) return;
      this.savingDeputy = true;
      try {
        const res = await API.call('PATCH', `/users/${APP.user.id}/deputy`, {
          deputy_id: this.deputySelected || null,
        });
        if (res?.success || res?.queued) {
          if (window.UI?.toast) UI.toast(this.deputySelected ? 'Deputy updated' : 'Deputy removed');
          this.user.deputy_id = this.deputySelected || null;
        } else if (res?.error) {
          if (window.UI?.toast) UI.toast(res.error);
        }
      } finally {
        this.savingDeputy = false;
      }
    },

    async removeDeputy() {
      this.deputySelected = '';
      await this.saveDeputy();
    },

    async requestLeave() {
      if (this.requestingLeave) return;
      if (!this.leaveFrom || !this.leaveTo) {
        if (window.UI?.toast) UI.toast('Both dates required');
        return;
      }
      this.requestingLeave = true;
      try {
        const res = await API.call('POST', '/users/me/leave', {
          from_date: this.leaveFrom,
          to_date:   this.leaveTo,
          reason:    this.leaveReason || null,
        });
        if (res?.success || res?.queued) {
          if (window.UI?.toast) UI.toast(res?.queued ? 'Leave queued — syncs when online' : 'Leave request submitted');
          this.leaveFrom = this.leaveTo = this.leaveReason = '';
        } else if (res?.error) {
          if (window.UI?.toast) UI.toast(res.error);
        }
      } finally {
        this.requestingLeave = false;
      }
    },
  };
};
