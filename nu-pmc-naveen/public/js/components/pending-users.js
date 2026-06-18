// public/js/components/pending-users.js
// ============================================================
// Alpine component: list of pending user approval requests,
// with approve/reject actions. Replaces APP.loadPendingUsers.
// ============================================================

window.Components = window.Components || {};

window.Components['pending-users'] = function() {
  return {
    loading: true,
    pending: [],
    busyIds: new Set(),

    get canInitiate() {
      return ['design_head','services_head','pmc_head'].includes(APP?.user?.role);
    },
    get hasPending() { return this.pending.length > 0; },

    async init() { await this.refresh(); },

    async refresh() {
      this.loading = true;
      const res = await API.call('GET', '/user-management/pending');
      this.pending = res?.pending || [];
      this.loading = false;
    },

    formatDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-IN') : ''; },
    formatRole(r)  { return (r || '').replace(/_/g, ' '); },

    async approve(id) {
      if (this.busyIds.has(id)) return;
      this.busyIds.add(id);
      const res = await API.call('POST', `/user-management/${id}/approve`);
      if (res?.success) {
        if (window.UI?.toast) UI.toast('User approved — credentials sent via WhatsApp ✓');
        await this.refresh();
      } else if (res?.queued) {
        if (window.UI?.toast) UI.toast('Queued offline — will sync');
      } else {
        if (window.UI?.toast) UI.toast(res?.error || 'Failed');
      }
      this.busyIds.delete(id);
    },

    async reject(id) {
      const reason = prompt('Reason for rejection (optional):');
      if (this.busyIds.has(id)) return;
      this.busyIds.add(id);
      const res = await API.call('POST', `/user-management/${id}/reject`, {
        rejection_reason: reason,
      });
      if (res?.success) {
        if (window.UI?.toast) UI.toast('User request rejected');
        await this.refresh();
      } else {
        if (window.UI?.toast) UI.toast(res?.error || 'Failed');
      }
      this.busyIds.delete(id);
    },

    openInitiate() {
      if (typeof APP?.showInitiateUser === 'function') APP.showInitiateUser();
    },
  };
};
