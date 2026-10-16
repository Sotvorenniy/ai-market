#!/bin/bash
# Writes a two-file order service into the empty eval workspace.
set -euo pipefail
mkdir -p src
cat > src/config.ts <<'EOF'
// Runtime settings for the order service.
export const config = {
  port: 8080,
  // Failed payment captures are retried this many times before the order is cancelled.
  paymentRetryLimit: 5,
  retryBackoffMs: 2000,
};
EOF
cat > src/payments.ts <<'EOF'
import { config } from './config';

export async function capture(orderId: string, charge: (id: string) => Promise<boolean>) {
  for (let attempt = 1; attempt <= config.paymentRetryLimit; attempt++) {
    if (await charge(orderId)) return true;
    await new Promise((resolve) => setTimeout(resolve, config.retryBackoffMs));
  }
  return false;
}
EOF
