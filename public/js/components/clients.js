// public/js/components/clients.js
// ============================================================
// Alpine component: client master list with incomplete + complete sections.
// Replaces APP.renderClients.
// Modal actions (showNewClient, showCompleteClient, showEditClient)
// still live in legacy app.js and are called from the template.
// ============================================================

window.Components = window.Components || {};

window.Components['clients'] = function() {
  return {
    loading:    true,
    accessError: null,
    incomplete: [],
    complete:   [],

    get hasIncomplete() { return this.incomplete.length > 0; },
    get hasComplete()   { return this.complete.length > 0; },

    async init() { await this.refresh(); },

    async refresh() {
      this.loading = true;
      this.accessError = null;
      const [allRes, incompleteRes] = await Promise.all([
        API.call('GET', '/clients'),
        API.call('GET', '/clients/incomplete'),
      ]);
      if (!allRes || allRes.error) {
        this.accessError = allRes?.error || 'Access denied';
        this.loading = false;
        return;
      }
      this.incomplete = incompleteRes?.clients || [];
      this.complete   = (allRes.clients || []).filter(c => c.master_complete === 1);
      this.loading = false;
    },

    get canBulkUpload() { return ['principal','design_principal','finance_admin'].includes(APP?.user?.role); },

    async bulkUpload(e) {
      const input = e.target;
      if (!input.files || !input.files[0]) return;
      if (typeof APP?.bulkUploadClients === 'function') await APP.bulkUploadClients(input);
      await this.refresh();
    },

    openNewClient() {
      if (typeof APP?.showNewClient === 'function') APP.showNewClient();
    },
    openCompleteClient(id, name) {
      if (typeof APP?.showCompleteClient === 'function') APP.showCompleteClient(id, name);
    },
    openEditClient(id) {
      if (typeof APP?.showEditClient === 'function') APP.showEditClient(id);
    },

    fmtDate(iso) { return (iso || '').split('T')[0]; },
  };
};
