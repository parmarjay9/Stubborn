#!/bin/sh
# Deploy Stubborn to AWS: backend (SAM) and/or frontend (Amplify, no Git needed).
#
#   scripts/deploy.sh            # both
#   scripts/deploy.sh backend
#   scripts/deploy.sh frontend
#
# Needs: aws login (or other AWS credentials), sam, node, python3.12.
# Nothing secret lives in this file. The TinyFish key is read from SSM at runtime.
set -eu

REGION="${AWS_REGION:-us-west-2}"
STACK="stubborn"
AMPLIFY_APP_ID="${AMPLIFY_APP_ID:-d3ephm9p0a7e00}"
BEDROCK_MODEL_ID="${BEDROCK_MODEL_ID:-us.anthropic.claude-sonnet-4-6}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE_URL="https://main.${AMPLIFY_APP_ID}.amplifyapp.com"
WHAT="${1:-all}"

api_url() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
}

if [ "$WHAT" = "all" ] || [ "$WHAT" = "backend" ]; then
  echo "== Backend"
  cd "$ROOT/backend"
  sam build
  sam deploy --stack-name "$STACK" --region "$REGION" --resolve-s3 --capabilities CAPABILITY_IAM \
    --no-confirm-changeset --no-fail-on-empty-changeset \
    --parameter-overrides BedrockModelId="$BEDROCK_MODEL_ID" DemoMode=1 FrontendUrl="$SITE_URL"
fi

if [ "$WHAT" = "all" ] || [ "$WHAT" = "frontend" ]; then
  echo "== Frontend"
  API="$(api_url)"
  cd "$ROOT/frontend"
  VITE_API_URL="$API" npm run build
  ZIP="$(mktemp -d)/site.zip"
  (cd dist && zip -qr "$ZIP" .)
  set -- $(aws amplify create-deployment --app-id "$AMPLIFY_APP_ID" --branch-name main --region "$REGION" \
    --query '[jobId,zipUploadUrl]' --output text)
  curl -sf -H 'Content-Type: application/zip' --upload-file "$ZIP" "$2" >/dev/null
  aws amplify start-deployment --app-id "$AMPLIFY_APP_ID" --branch-name main --job-id "$1" --region "$REGION" >/dev/null
  status=PENDING
  while [ "$status" != "SUCCEED" ] && [ "$status" != "FAILED" ]; do
    sleep 3
    status="$(aws amplify get-job --app-id "$AMPLIFY_APP_ID" --branch-name main --job-id "$1" --region "$REGION" \
      --query job.summary.status --output text)"
  done
  echo "Frontend deploy: $status"
  [ "$status" = "SUCCEED" ]
fi

echo "Site: $SITE_URL"
