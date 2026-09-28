const AppleHealth = {
  mapSteps(metrics){ return metrics.filter(m=>m.name.toLowerCase().includes('step')); }
};
