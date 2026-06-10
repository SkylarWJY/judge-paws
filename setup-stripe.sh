#!/usr/bin/env bash
# Reads STRIPE_SECRET_KEY from .env, creates a $2.99/mo recurring price,
# and writes STRIPE_PRICE_MONTHLY back into .env. Run after pasting your sk_test key.
set -e
cd "$(dirname "$0")"
KEY=$(grep -E '^STRIPE_SECRET_KEY=' .env | cut -d= -f2-)
[ -z "$KEY" ] || [ "$KEY" = "sk_test_..." ] && { echo "Set STRIPE_SECRET_KEY in .env first."; exit 1; }

PROD=$(stripe products create --api-key "$KEY" \
  -d "name=Judge Paws+" -d "description=Unlimited verdicts, Savage mode, appeals" \
  --format json | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "product: $PROD"

PRICE=$(stripe prices create --api-key "$KEY" \
  -d "product=$PROD" -d "unit_amount=299" -d "currency=usd" \
  -d "recurring[interval]=month" \
  --format json | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "price: $PRICE"

# write price into .env
if grep -q '^STRIPE_PRICE_MONTHLY=' .env; then
  sed -i '' "s|^STRIPE_PRICE_MONTHLY=.*|STRIPE_PRICE_MONTHLY=$PRICE|" .env
else
  echo "STRIPE_PRICE_MONTHLY=$PRICE" >> .env
fi
echo "✓ .env updated with STRIPE_PRICE_MONTHLY=$PRICE"
