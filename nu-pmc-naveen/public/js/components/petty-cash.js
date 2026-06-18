// public/js/components/petty-cash.js
// ============================================================
// Alpine component: Petty cash float view + transaction log.
// Replaces APP.loadPettyCash. Action modals (add spend, replenish)
// still live in legacy app.js for now — this component triggers them.
// ============================================================

window.Components = window.Components || {};

window.Components['petty-cash'] = function(props) {
  const projectId = props?.projectId;
  return {
    loading:   true,
    balance:   0,
    totalSpent:       0,
    totalReplenished: 0,
    transactions:     [],

    get isPMC() {
      return ['principal','design_principal','pmc_head'].includes(APP?.user?.role);
    },
    get isPrincipal() {
      return ['principal','design_principal'].includes(APP?.user?.role);
    },
    get balanceColor() {
      return this.balance < 2000 ? '#C87060' : '#4A8A5A';
    },

    fmtRupee(n) {
      return '₹' + (Number(n) || 0).toLocaleString('en-IN');
    },

    async init() {
      await this.refresh();
    },

    async refresh() {
      this.loading = true;
      const res = await API.call('GET', `/finance/${projectId}/petty-cash`);
      if (res) {
        this.balance          = res.balance || 0;
        this.totalSpent       = res.total_spent || 0;
        this.totalReplenished = res.total_replenished || 0;
        this.transactions     = (res.transactions || []).slice(0, 20);
      }
      this.loading = false;
    },

    openAddSpend() {
      if (typeof APP?.showAddCashTxn === 'function') APP.showAddCashTxn(projectId);
    },
    openReplenish() {
      if (typeof APP?.showReplenish === 'function') APP.showReplenish(projectId);
    },
  };
};
