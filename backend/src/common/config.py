"""Central config. Legal values live here with a source, never inline."""
import os
from decimal import Decimal

# Arizona minimum wage, effective January 1, 2026: $15.15 per hour.
# Source: Industrial Commission of Arizona, "2026 Minimum Wage Increase,
# Effective January 1, 2026"
# https://www.azica.gov/news/2026-minimum-wage-increase-effective-january-1-2026
# Cross-checked against the US DOL state minimum wage table
# https://www.dol.gov/agencies/whd/minimum-wage/state  (checked 2026-11-14)
AZ_MIN_WAGE = Decimal("15.15")

# Federal FLSA overtime: hours over 40 in a workweek at 1.5x the regular rate.
OVERTIME_THRESHOLD_HOURS = Decimal("40")
OVERTIME_MULTIPLIER = Decimal("1.5")

# First day of the workweek, Python weekday numbering (Mon=0 ... Sun=6).
WORKWEEK_START_WEEKDAY = 6  # Sunday through Saturday

ZERO_HASH = "0" * 64

DEMO_MODE = os.environ.get("DEMO_MODE", "1") == "1"

# Bedrock. Claude Sonnet 4.6 is the model this AWS account has an accepted
# Marketplace agreement for (2026-11-15). The ID is its US cross-region
# inference profile. Override with the BedrockModelId stack parameter.
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-4-6")
BEDROCK_REGION = os.environ.get("BEDROCK_REGION") or os.environ.get("AWS_REGION", "us-west-2")

# TinyFish Web Agent API (docs.tinyfish.ai, checked 2026-11-14).
TINYFISH_BASE_URL = "https://agent.tinyfish.ai"
TINYFISH_KEY_PARAM = os.environ.get("TINYFISH_KEY_PARAM", "/stubborn/tinyfish-api-key")
AGENT_MAX_SECONDS = 90

# Public URL of the deployed frontend. The agent opens the demo claim form there.
FRONTEND_URL = os.environ.get("FRONTEND_URL", "").rstrip("/")

LOCAL = os.environ.get("STUBBORN_LOCAL") == "1"
