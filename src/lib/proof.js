import { ref } from 'vue'
import { DEMO_MODE } from './demoMode'
export { proofLines } from './proofRules.js'

// The landing pages' proof numbers (src/lib/proofRules.js decides what's shown). Never sample numbers, even in
// demo mode, so a screenshot can't pass off made-up proof.
const stats = ref(null)
let loading = null
// Fetched once per visit, shared by every page that shows it.
export function useProof() {
  if (!DEMO_MODE) {
    loading ??= fetch('/api/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((s) => { stats.value = s })
      .catch(() => {})
  }
  return stats
}
